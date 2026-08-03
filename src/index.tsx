import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-pages'

import {
  CHAPTERS,
  OFFICERS,
  DISTRICT,
  STATUS_LIST,
  WORKFLOW_STEPS,
  REQUIRED_DOCS,
  officerCanSeeChapterKey,
  officerCanSeeArea,
  getChapter,
} from '../shared/reference'
import type { OfficerPublic } from '../shared/types'
import { readSession, setSession, clearSession } from './lib/session'
import {
  listCandidates,
  getCandidate,
  candidateExists,
  insertCandidate,
  insertCandidates,
  updateCandidateDoc,
  logAudit,
  ensureReady,
  countCredentials,
  getCredentialByOfficerId,
  getCredentialByEmail,
  listCredentialsMeta,
  upsertCredential,
  recordFailedLogin,
  resetFailedLogins,
  setPassword,
} from './lib/db'
import { makeCandidate, parseCandidateCSV, buildCSVTemplate } from './lib/candidate-factory'
import { hashPassword, verifyPassword, randomTempPassword } from './lib/password'
import { OFFICER_EMAILS, MAX_LOGIN_ATTEMPTS, LOCKOUT_MINUTES, MIN_PASSWORD_LENGTH } from './lib/auth'

export type Bindings = {
  DB: D1Database
  UPLOADS: R2Bucket
  SESSION_SECRET?: string
  AUTH_BOOTSTRAP_SECRET?: string
  ASSETS: Fetcher
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

function secretOf(env: Bindings): string {
  return env.SESSION_SECRET || 'dev-secret-tcac-intake-do-not-use-in-real-prod'
}

type SessionOfficer = OfficerPublic & { mustChangePassword?: boolean }

async function currentOfficer(c: any): Promise<SessionOfficer | null> {
  const id = await readSession(c, secretOf(c.env))
  if (!id) return null
  const officer = OFFICERS[id]
  if (!officer) return null
  const cred = await getCredentialByOfficerId(c.env.DB, id)
  return { ...officer, mustChangePassword: cred ? cred.must_change === 1 : false }
}

function allowedChapterKeysFor(officer: OfficerPublic | null): string[] | 'all' {
  if (!officer || officer.scope === 'all') return 'all'
  return Object.values(CHAPTERS)
    .filter((ch) => officer.scope !== 'all' && (officer.scope as number[]).includes(ch.area))
    .map((ch) => ch.key)
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

app.post('/api/auth/signin', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>().catch(() => ({}))
  const email = (body.email || '').trim()
  const password = body.password || ''
  const genericError = 'Incorrect email or password.'
  if (!email || !password) return c.json({ error: genericError }, 401)

  const cred = await getCredentialByEmail(c.env.DB, email)
  if (!cred) return c.json({ error: genericError }, 401)

  const officer = OFFICERS[cred.officer_id]
  if (!officer) return c.json({ error: genericError }, 401)

  if (cred.locked_until && new Date(cred.locked_until).getTime() > Date.now()) {
    const minutesLeft = Math.ceil((new Date(cred.locked_until).getTime() - Date.now()) / 60_000)
    return c.json({ error: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.` }, 423)
  }

  const ok = await verifyPassword(password, cred.password_hash, cred.password_salt, cred.iterations)
  if (!ok) {
    await recordFailedLogin(c.env.DB, cred.officer_id, MAX_LOGIN_ATTEMPTS, LOCKOUT_MINUTES)
    const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - (cred.failed_attempts + 1))
    if (remaining <= 0) {
      return c.json({ error: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.` }, 423)
    }
    return c.json({ error: `${genericError} ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout.` }, 401)
  }

  await resetFailedLogins(c.env.DB, cred.officer_id)
  await setSession(c, secretOf(c.env), officer.id)
  return c.json({ officer: { ...officer, mustChangePassword: cred.must_change === 1 } })
})

app.post('/api/auth/signout', async (c) => {
  clearSession(c)
  return c.json({ ok: true })
})

app.get('/api/auth/me', async (c) => {
  const officer = await currentOfficer(c)
  return c.json({ officer })
})

function requireOfficer(c: any, officer: OfficerPublic | null) {
  if (!officer) {
    return c.json({ error: 'Not signed in' }, 401)
  }
  return null
}

// Change own password — used both for the voluntary "change password" action
// and the forced first-login flow (must_change=1 after admin reset/bootstrap).
app.post('/api/auth/change-password', async (c) => {
  const officer = await currentOfficer(c)
  const denied = requireOfficer(c, officer)
  if (denied) return denied

  const body = await c.req.json<{ currentPassword?: string; newPassword?: string }>().catch(() => ({}))
  const currentPassword = body.currentPassword || ''
  const newPassword = body.newPassword || ''

  const cred = await getCredentialByOfficerId(c.env.DB, officer!.id)
  if (!cred) return c.json({ error: 'No credential record found for this officer.' }, 400)

  const ok = await verifyPassword(currentPassword, cred.password_hash, cred.password_salt, cred.iterations)
  if (!ok) return c.json({ error: 'Current password is incorrect.' }, 401)

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return c.json({ error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` }, 422)
  }
  if (newPassword === currentPassword) {
    return c.json({ error: 'New password must be different from your current password.' }, 422)
  }

  const { hash, salt, iterations } = await hashPassword(newPassword)
  await setPassword(c.env.DB, officer!.id, hash, salt, iterations, false)
  return c.json({ ok: true })
})

// ---------------------------------------------------------------------------
// District-tier admin: officer directory + password resets
// ---------------------------------------------------------------------------
// Since there's no email/SSO service wired up, District Director / Chief
// Dean of Membership Intake / Chief Administrator can generate a one-time
// temp password for any officer here and relay it to them out of band
// (phone/text/in person). The officer is forced to change it on next login.

function requireDistrictTier(c: any, officer: OfficerPublic | null) {
  if (!officer) return c.json({ error: 'Not signed in' }, 401)
  if (officer.tier !== 'district') return c.json({ error: 'District-tier officers only.' }, 403)
  return null
}

app.get('/api/auth/admin/officers', async (c) => {
  const officer = await currentOfficer(c)
  const denied = requireDistrictTier(c, officer)
  if (denied) return denied

  const metas = await listCredentialsMeta(c.env.DB)
  const byId = new Map(metas.map((m) => [m.officer_id, m]))
  const rows = Object.values(OFFICERS).map((o) => {
    const meta = byId.get(o.id)
    return {
      officer: o,
      email: meta?.email || OFFICER_EMAILS[o.id] || null,
      hasCredential: !!meta,
      mustChangePassword: meta ? meta.must_change === 1 : false,
      lockedUntil: meta?.locked_until || null,
      failedAttempts: meta?.failed_attempts || 0,
    }
  })
  return c.json({ rows })
})

app.post('/api/auth/admin/reset-password', async (c) => {
  const officer = await currentOfficer(c)
  const denied = requireDistrictTier(c, officer)
  if (denied) return denied

  const body = await c.req.json<{ officerId?: string }>().catch(() => ({}))
  const targetId = body.officerId || ''
  const target = OFFICERS[targetId]
  if (!target) return c.json({ error: 'Unknown officer' }, 400)

  const email = OFFICER_EMAILS[targetId]
  if (!email) return c.json({ error: 'No login email is configured for that officer.' }, 400)

  const tempPassword = randomTempPassword()
  const { hash, salt, iterations } = await hashPassword(tempPassword)
  await upsertCredential(c.env.DB, targetId, email, hash, salt, iterations, true)
  await logAudit(c.env.DB, 'system', officer!.id, 'password_reset', `${officer!.name} reset the password for ${target.name}`)

  return c.json({ officerId: targetId, email, tempPassword })
})

// One-time bootstrap: seeds a temp password for every officer that doesn't
// yet have a credential row. Self-disables once every officer has one, and
// always requires AUTH_BOOTSTRAP_SECRET (a Worker secret, set out of band —
// never checked into wrangler.jsonc) so it can't be replayed by the public.
app.post('/api/auth/bootstrap', async (c) => {
  const configured = c.env.AUTH_BOOTSTRAP_SECRET
  if (!configured) return c.json({ error: 'Bootstrap is not enabled on this deployment.' }, 403)

  const body = await c.req.json<{ secret?: string }>().catch(() => ({}))
  if (body.secret !== configured) return c.json({ error: 'Invalid bootstrap secret.' }, 403)

  const existing = await listCredentialsMeta(c.env.DB)
  const existingIds = new Set(existing.map((m) => m.officer_id))
  const toSeed = Object.values(OFFICERS).filter((o) => !existingIds.has(o.id))
  if (toSeed.length === 0) {
    return c.json({ error: 'All officers already have credentials. Use /api/auth/admin/reset-password instead.' }, 409)
  }

  const results: { officerId: string; name: string; email: string; tempPassword: string }[] = []
  for (const o of toSeed) {
    const email = OFFICER_EMAILS[o.id]
    if (!email) continue
    const tempPassword = randomTempPassword()
    const { hash, salt, iterations } = await hashPassword(tempPassword)
    await upsertCredential(c.env.DB, o.id, email, hash, salt, iterations, true)
    results.push({ officerId: o.id, name: o.name, email, tempPassword })
  }
  return c.json({ seeded: results.length, officers: results })
})

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

app.get('/api/reference', (c) => {
  return c.json({
    chapters: CHAPTERS,
    officers: Object.values(OFFICERS),
    district: DISTRICT,
    statuses: STATUS_LIST,
    workflowSteps: WORKFLOW_STEPS,
    requiredDocs: REQUIRED_DOCS,
  })
})

// ---------------------------------------------------------------------------
// Candidates — roster / detail / create / missing-report
// ---------------------------------------------------------------------------

app.get('/api/candidates', async (c) => {
  const officer = await currentOfficer(c)
  const denied = requireOfficer(c, officer)
  if (denied) return denied

  const { q, status, type, chapter, sort } = c.req.query()
  const allowed = allowedChapterKeysFor(officer)
  const list = await listCandidates(c.env.DB, {
    q, status, type, chapterKey: chapter, sort,
    allowedChapterKeys: allowed,
  })
  return c.json({ candidates: list })
})

app.get('/api/candidates/missing-report', async (c) => {
  const officer = await currentOfficer(c)
  const denied = requireOfficer(c, officer)
  if (denied) return denied

  const allowed = allowedChapterKeysFor(officer)
  const list = await listCandidates(c.env.DB, { allowedChapterKeys: allowed, sort: 'id' })
  const rows: any[] = []
  list.forEach((cand) => {
    REQUIRED_DOCS.forEach((d) => {
      const doc = cand.docs[d.key]
      if (!doc || !doc.present || !doc.valid) {
        rows.push({
          candidateId: cand.id,
          candidateName: cand.name,
          candidateInitials: cand.initials,
          chapterKey: cand.chapterKey,
          school: cand.school,
          doc: d,
          state: !doc?.present ? 'missing' : 'flagged',
          note: doc?.note || 'Not received',
        })
      }
    })
  })
  return c.json({ rows })
})

app.get('/api/candidates/csv-template', (c) => {
  const csv = buildCSVTemplate()
  return c.body(csv, 200, {
    'Content-Type': 'text/csv',
    'Content-Disposition': 'attachment; filename="apa_intake_template.csv"',
  })
})

app.post('/api/candidates/csv/preview', async (c) => {
  const officer = await currentOfficer(c)
  const denied = requireOfficer(c, officer)
  if (denied) return denied

  const { csv } = await c.req.json<{ csv?: string }>().catch(() => ({ csv: '' }))
  const parsed = parseCandidateCSV(csv || '')

  const existing = await Promise.all(parsed.rows.map((r) => candidateExists(c.env.DB, String(r.id))))
  const annotated = parsed.rows.map((r, i) => {
    const chapter = CHAPTERS[r.chapterKey]
    const inScope = officerCanSeeArea(officer, chapter?.area ?? -1)
    return {
      ...r,
      chapterName: chapter?.name,
      duplicate: existing[i],
      outOfScope: !inScope,
      willImport: !existing[i] && inScope,
    }
  })
  return c.json({ rows: annotated, errors: parsed.errors })
})

app.post('/api/candidates/csv/commit', async (c) => {
  const officer = await currentOfficer(c)
  const denied = requireOfficer(c, officer)
  if (denied) return denied

  const { csv } = await c.req.json<{ csv?: string }>().catch(() => ({ csv: '' }))
  const parsed = parseCandidateCSV(csv || '')

  const toInsert = []
  for (const r of parsed.rows) {
    const chapter = CHAPTERS[r.chapterKey]
    if (!chapter) continue
    if (!officerCanSeeArea(officer, chapter.area)) continue
    if (await candidateExists(c.env.DB, String(r.id))) continue
    toInsert.push(makeCandidate(r))
  }
  await insertCandidates(c.env.DB, toInsert)
  for (const cand of toInsert) {
    await logAudit(c.env.DB, cand.id, officer!.id, 'csv_import', `Imported via CSV by ${officer!.name}`)
  }
  return c.json({ inserted: toInsert.length })
})

app.post('/api/candidates', async (c) => {
  const officer = await currentOfficer(c)
  const denied = requireOfficer(c, officer)
  if (denied) return denied

  const body = await c.req.json().catch(() => null)
  if (!body) return c.json({ error: 'Invalid JSON body' }, 400)

  const errors: Record<string, string> = {}
  if (!body.id || !String(body.id).trim()) errors.id = 'Required'
  if (!body.firstName || !String(body.firstName).trim()) errors.firstName = 'Required'
  if (!body.lastName || !String(body.lastName).trim()) errors.lastName = 'Required'
  if (!body.email || !String(body.email).includes('@')) errors.email = 'Valid email required'
  if (!body.school || !String(body.school).trim()) errors.school = 'Required'
  if (!body.chapterKey || !CHAPTERS[body.chapterKey]) errors.chapterKey = 'Chapter selection required'
  const gpaNum = parseFloat(body.gpa)
  if (body.gpa && (isNaN(gpaNum) || gpaNum < 0 || gpaNum > 4.5)) errors.gpa = 'GPA must be 0.00–4.50'

  if (!errors.id && (await candidateExists(c.env.DB, String(body.id).trim()))) {
    errors.id = `Candidate #${body.id} already exists`
  }
  if (!errors.chapterKey && officer && !officerCanSeeChapterKey(officer, body.chapterKey)) {
    errors.chapterKey = 'That chapter is outside your area of responsibility'
  }
  if (Object.keys(errors).length) return c.json({ errors }, 422)

  const fullName = [body.firstName, body.middleName, body.lastName].filter(Boolean).join(' ')
  const candidate = makeCandidate({
    id: String(body.id).trim(),
    name: fullName,
    email: String(body.email).trim(),
    phone: (body.phone || '').trim(),
    address: (body.address || '').trim(),
    dob: (body.dob || '').trim(),
    school: String(body.school).trim(),
    major: (body.major || '').trim(),
    minor: (body.minor || '').trim(),
    classification: body.classification || 'Undergraduate',
    gpa: gpaNum || 0,
    gradDate: (body.gradDate || '').trim(),
    chapterKey: body.chapterKey,
    term: body.term || '2026 FALL',
    sponsorName: (body.sponsorName || '').trim(),
    recommenderName: (body.recommenderName || '').trim(),
  })
  await insertCandidate(c.env.DB, candidate)
  await logAudit(c.env.DB, candidate.id, officer!.id, 'create', `Manually added by ${officer!.name}`)
  return c.json({ candidate })
})

app.get('/api/candidates/:id', async (c) => {
  const officer = await currentOfficer(c)
  const denied = requireOfficer(c, officer)
  if (denied) return denied

  const candidate = await getCandidate(c.env.DB, c.req.param('id'))
  if (!candidate) return c.json({ error: 'Not found' }, 404)

  if (!officerCanSeeChapterKey(officer, candidate.chapterKey)) {
    const chapter = getChapter(candidate.chapterKey)
    return c.json({
      error: 'access_denied',
      chapter,
      areaName: DISTRICT.areaNames[String(chapter.area)],
    }, 403)
  }

  return c.json({ candidate })
})

app.post('/api/candidates/:id/docs/:docKey', async (c) => {
  const officer = await currentOfficer(c)
  const denied = requireOfficer(c, officer)
  if (denied) return denied

  const { id, docKey } = c.req.param()
  const candidate = await getCandidate(c.env.DB, id)
  if (!candidate) return c.json({ error: 'Not found' }, 404)
  if (!officerCanSeeChapterKey(officer, candidate.chapterKey)) return c.json({ error: 'access_denied' }, 403)
  if (!REQUIRED_DOCS.some((d) => d.key === docKey)) return c.json({ error: 'Unknown document type' }, 400)

  const form = await c.req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return c.json({ error: 'No file provided' }, 400)
  if (file.size > 25 * 1024 * 1024) return c.json({ error: 'File exceeds 25 MB limit' }, 413)

  const key = `candidates/${id}/${docKey}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`
  await c.env.UPLOADS.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  })

  const wasReplaced = !!candidate.docs[docKey]?.file
  const doc = {
    present: true,
    valid: true,
    note: wasReplaced ? `Replaced · ${file.name} · ${(file.size / 1024).toFixed(0)} KB` : `Uploaded ${file.name} · ${(file.size / 1024).toFixed(0)} KB`,
    file: `/api/files/${key}`,
    uploadedAt: new Date().toISOString(),
  }
  const updated = await updateCandidateDoc(c.env.DB, id, docKey, doc)
  await logAudit(c.env.DB, id, officer!.id, wasReplaced ? 'doc_replace' : 'doc_upload', `${docKey} by ${officer!.name}`)
  return c.json({ candidate: updated })
})

app.get('/api/files/*', async (c) => {
  const key = c.req.path.replace(/^\/api\/files\//, '')
  const obj = await c.env.UPLOADS.get(key)
  if (!obj) return c.notFound()
  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
    },
  })
})

// ---------------------------------------------------------------------------
// Static assets + SPA fallback
// ---------------------------------------------------------------------------
// Cloudflare Pages "advanced mode" (_worker.js) routes every request through
// this Worker — including requests for files that exist in dist/. We proxy
// those to the ASSETS binding, and fall back to index.html for any route
// that isn't a real static file, so client-side routes (react-router) work
// on hard refresh / direct link (e.g. /candidates/2897040).

app.get('/static/*', serveStatic())

app.get('*', async (c) => {
  const res = await c.env.ASSETS.fetch(c.req.raw)
  if (res.status !== 404) return res
  const url = new URL(c.req.url)
  url.pathname = '/index.html'
  const fallback = await c.env.ASSETS.fetch(new Request(url.toString(), c.req.raw))
  return new Response(fallback.body, { status: 200, headers: fallback.headers })
})

export default app
