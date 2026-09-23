import { Hono } from 'hono'
import { cors } from 'hono/cors'

import {
  CHAPTERS,
  DISTRICT,
  STATUS_LIST,
  WORKFLOW_STEPS,
  REQUIRED_DOCS,
  requiredDocsFor,
  officerCanSeeChapterKey,
  officerCanSeeArea,
  getChapter,
} from '../shared/reference.js'
import type { OfficerPublic, Candidate, Brother } from '../shared/types.js'
import { readSession, setSession, clearSession } from './lib/session.js'
import {
  listCandidates,
  getCandidate,
  candidateExists,
  insertCandidate,
  insertCandidates,
  clearAllCandidates,
  updateCandidateDoc,
  updateCandidateFields,
  logAudit,
  countCredentials,
  getCredentialByOfficerId,
  getCredentialByEmail,
  listCredentialsMeta,
  upsertCredential,
  recordFailedLogin,
  resetFailedLogins,
  setPassword,
  listOfficers,
  getOfficer,
  officerIdExists,
  countActiveDistrictOfficers,
  createOfficer,
  updateOfficer,
  officerRowToPublic,
  type OfficerRow,
} from './lib/db.js'
import { putFile, getFile } from './lib/storage.js'
import { makeCandidate, parseCandidateCSV, buildCSVTemplate } from './lib/candidate-factory.js'
import { hashPassword, verifyPassword, randomTempPassword } from './lib/password.js'
import { MAX_LOGIN_ATTEMPTS, LOCKOUT_MINUTES, MIN_PASSWORD_LENGTH } from './lib/auth.js'
import { extractHeadshot, parseApplicationFields, extractLetterTexts, extractPdfText, extractMembershipFeesBalance } from './lib/pdf-parse.js'
import { redactSensitiveInfo } from './lib/redact.js'
import { countWords, MIN_ESSAY_WORDS } from '../shared/word-count.js'

const app = new Hono().basePath('/api')

// Documents that require a real signature or school seal to be valid --
// something OCR can't reliably confirm -- so a fresh upload starts flagged
// for officer verification rather than assumed valid. See the "Flag for
// Review" / "Clear Flag" doc endpoint for how an officer resolves this.
const NEEDS_VERIFICATION_NOTES: Record<string, string> = {
  transcript: 'Needs officer verification: must include a signature or the school seal.',
  enrollmentLetter: 'Needs officer verification: must be signed by the Office of the Registrar.',
  medical: 'Needs officer verification: must be signed by both the candidate and the physician.',
  nda: "Needs officer verification: must be signed by the candidate, and by a parent/guardian if the candidate is under 18.",
}

// Which "Application Workflow" step a given document's upload marks done --
// "received," not "valid" (a flagged-for-verification doc is still received).
// Not every REQUIRED_DOCS key has a corresponding workflow step (enrollment
// letter, NDA, and headshot don't), so this only covers the ones that do.
const WORKFLOW_STEP_FOR_DOC: Record<string, string> = {
  application: 'appSubmitted',
  essay: 'essayReceived',
  resume: 'resumeReceived',
  medical: 'medicalReceived',
  voter: 'voterReceived',
  transcript: 'transcriptReceived',
}

app.use('*', cors())

function secretOf(): string {
  return process.env.SESSION_SECRET || 'dev-secret-tcac-intake-do-not-use-in-real-prod'
}

type SessionOfficer = OfficerPublic & { mustChangePassword?: boolean }

async function currentOfficer(c: any): Promise<SessionOfficer | null> {
  const id = await readSession(c, secretOf())
  if (!id) return null
  const row = await getOfficer(id)
  if (!row || !row.active) return null
  const cred = await getCredentialByOfficerId(id)
  return { ...officerRowToPublic(row), mustChangePassword: cred ? cred.must_change === 1 : false }
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

app.post('/auth/signin', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>().catch(() => ({}) as { email?: string; password?: string })
  const email = (body.email || '').trim()
  const password = body.password || ''
  const genericError = 'Incorrect email or password.'
  if (!email || !password) return c.json({ error: genericError }, 401)

  const cred = await getCredentialByEmail(email)
  if (!cred) return c.json({ error: genericError }, 401)

  const officerRow = await getOfficer(cred.officer_id)
  if (!officerRow || !officerRow.active) return c.json({ error: genericError }, 401)
  const officer = officerRowToPublic(officerRow)

  if (cred.locked_until && new Date(cred.locked_until).getTime() > Date.now()) {
    const minutesLeft = Math.ceil((new Date(cred.locked_until).getTime() - Date.now()) / 60_000)
    return c.json({ error: `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.` }, 423)
  }

  const ok = await verifyPassword(password, cred.password_hash, cred.password_salt, cred.iterations)
  if (!ok) {
    await recordFailedLogin(cred.officer_id, MAX_LOGIN_ATTEMPTS, LOCKOUT_MINUTES)
    const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - (cred.failed_attempts + 1))
    if (remaining <= 0) {
      return c.json({ error: `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.` }, 423)
    }
    return c.json({ error: `${genericError} ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout.` }, 401)
  }

  await resetFailedLogins(cred.officer_id)
  await setSession(c, secretOf(), officer.id)
  return c.json({ officer: { ...officer, mustChangePassword: cred.must_change === 1 } })
})

app.post('/auth/signout', async (c) => {
  clearSession(c)
  return c.json({ ok: true })
})

app.get('/auth/me', async (c) => {
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
app.post('/auth/change-password', async (c) => {
  const officer = await currentOfficer(c)
  const denied = requireOfficer(c, officer)
  if (denied) return denied

  const body = await c.req.json<{ currentPassword?: string; newPassword?: string }>().catch(() => ({}) as { currentPassword?: string; newPassword?: string })
  const currentPassword = body.currentPassword || ''
  const newPassword = body.newPassword || ''

  const cred = await getCredentialByOfficerId(officer!.id)
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
  await setPassword(officer!.id, hash, salt, iterations, false)
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

app.get('/auth/admin/officers', async (c) => {
  const officer = await currentOfficer(c)
  const denied = requireDistrictTier(c, officer)
  if (denied) return denied

  const [officerRows, metas] = await Promise.all([listOfficers(true), listCredentialsMeta()])
  const byId = new Map(metas.map((m) => [m.officer_id, m]))
  const rows = officerRows.map((o) => {
    const meta = byId.get(o.id)
    return {
      officer: officerRowToPublic(o),
      active: o.active,
      email: meta?.email || o.email || null,
      hasCredential: !!meta,
      mustChangePassword: meta ? meta.must_change === 1 : false,
      lockedUntil: meta?.locked_until || null,
      failedAttempts: meta?.failed_attempts || 0,
    }
  })
  return c.json({ rows })
})

// Turns a display name + optional area into a URL/id-safe slug matching the
// existing convention (surname, or surname-area for area-tier officers —
// e.g. "tanner-4041"), then disambiguates against any existing officer id.
function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function deriveOfficerId(name: string, area?: number | null): string {
  const parts = name.replace(/^Bro\.\s*/i, '').trim().split(/\s+/)
  const surname = slugify(parts[parts.length - 1] || 'officer') || 'officer'
  return area ? `${surname}-${area}` : surname
}

async function uniqueOfficerId(base: string): Promise<string> {
  let candidate = base
  let n = 2
  while (await officerIdExists(candidate)) {
    candidate = `${base}-${n}`
    n++
  }
  return candidate
}

app.post('/auth/admin/officers', async (c) => {
  const officer = await currentOfficer(c)
  const denied = requireDistrictTier(c, officer)
  if (denied) return denied

  const body = await c.req.json<{ name?: string; title?: string; initials?: string; tier?: string; area?: number; email?: string }>()
    .catch(() => ({}) as { name?: string; title?: string; initials?: string; tier?: string; area?: number; email?: string })
  const name = (body.name || '').trim()
  const title = (body.title || '').trim()
  const initials = (body.initials || '').trim().toUpperCase()
  const tier = body.tier === 'district' ? 'district' : body.tier === 'area' ? 'area' : null
  const area = body.area ? Number(body.area) : null
  const email = (body.email || '').trim()

  if (!name || !title || !initials || !tier || !email) {
    return c.json({ error: 'Name, title, initials, tier, and email are all required.' }, 422)
  }
  if (tier === 'area' && !area) {
    return c.json({ error: 'Area-tier officers need an area.' }, 422)
  }

  const id = await uniqueOfficerId(deriveOfficerId(name, area))
  const scope: 'all' | number[] = tier === 'district' ? 'all' : [area!]
  const created = await createOfficer({ id, name, title, initials, area, tier, scope, email })
  await logAudit('system', officer!.id, 'officer_added', `${officer!.name} added officer ${created.name} (${created.id})`)

  return c.json({ officer: officerRowToPublic(created) })
})

app.patch('/auth/admin/officers/:id', async (c) => {
  const officer = await currentOfficer(c)
  const denied = requireDistrictTier(c, officer)
  if (denied) return denied

  const targetId = c.req.param('id')
  const existing = await getOfficer(targetId)
  if (!existing) return c.json({ error: 'Unknown officer' }, 404)

  const body = await c.req.json<{ name?: string; title?: string; initials?: string; tier?: string; area?: number | null; email?: string; active?: boolean }>()
    .catch(() => ({}) as { name?: string; title?: string; initials?: string; tier?: string; area?: number | null; email?: string; active?: boolean })

  const fields: Partial<Omit<OfficerRow, 'id'>> = {}
  if (body.name !== undefined) fields.name = body.name.trim()
  if (body.title !== undefined) fields.title = body.title.trim()
  if (body.initials !== undefined) fields.initials = body.initials.trim().toUpperCase()
  if (body.email !== undefined) fields.email = body.email.trim()

  const tier = body.tier === 'district' ? 'district' : body.tier === 'area' ? 'area' : existing.tier
  const area = body.area !== undefined ? (body.area ? Number(body.area) : null) : existing.area
  if (tier === 'area' && !area) return c.json({ error: 'Area-tier officers need an area.' }, 422)
  if (body.tier !== undefined || body.area !== undefined) {
    fields.tier = tier
    fields.area = area
    fields.scope = tier === 'district' ? 'all' : [area!]
  }

  if (body.active === false && existing.tier === 'district') {
    const remaining = await countActiveDistrictOfficers(existing.id)
    if (remaining === 0) {
      return c.json({ error: 'Cannot remove the last active district-tier officer.' }, 400)
    }
  }
  if (body.active !== undefined) fields.active = body.active

  const updated = await updateOfficer(targetId, fields)
  if (!updated) return c.json({ error: 'Unknown officer' }, 404)
  await logAudit('system', officer!.id, 'officer_updated', `${officer!.name} updated officer ${updated.name} (${updated.id})`)

  return c.json({ officer: officerRowToPublic(updated) })
})

app.delete('/auth/admin/officers/:id', async (c) => {
  const officer = await currentOfficer(c)
  const denied = requireDistrictTier(c, officer)
  if (denied) return denied

  const targetId = c.req.param('id')
  const existing = await getOfficer(targetId)
  if (!existing) return c.json({ error: 'Unknown officer' }, 404)

  if (existing.tier === 'district') {
    const remaining = await countActiveDistrictOfficers(existing.id)
    if (remaining === 0) {
      return c.json({ error: 'Cannot remove the last active district-tier officer.' }, 400)
    }
  }

  await updateOfficer(targetId, { active: false })
  await logAudit('system', officer!.id, 'officer_removed', `${officer!.name} removed officer ${existing.name} (${existing.id})`)

  return c.json({ ok: true })
})

app.post('/auth/admin/reset-password', async (c) => {
  const officer = await currentOfficer(c)
  const denied = requireDistrictTier(c, officer)
  if (denied) return denied

  const body = await c.req.json<{ officerId?: string }>().catch(() => ({}) as { officerId?: string })
  const targetId = body.officerId || ''
  const target = await getOfficer(targetId)
  if (!target || !target.active) return c.json({ error: 'Unknown officer' }, 400)

  const email = target.email
  if (!email) return c.json({ error: 'No login email is configured for that officer.' }, 400)

  const tempPassword = randomTempPassword()
  const { hash, salt, iterations } = await hashPassword(tempPassword)
  await upsertCredential(targetId, email, hash, salt, iterations, true)
  await logAudit('system', officer!.id, 'password_reset', `${officer!.name} reset the password for ${target.name}`)

  return c.json({ officerId: targetId, email, tempPassword })
})

// One-time bootstrap: seeds a temp password for every officer that doesn't
// yet have a credential row. Self-disables once every officer has one, and
// always requires AUTH_BOOTSTRAP_SECRET (a Vercel env var, set out of band —
// never checked into the repo) so it can't be replayed by the public.
app.post('/auth/bootstrap', async (c) => {
  const configured = process.env.AUTH_BOOTSTRAP_SECRET
  if (!configured) return c.json({ error: 'Bootstrap is not enabled on this deployment.' }, 403)

  const body = await c.req.json<{ secret?: string }>().catch(() => ({}) as { secret?: string })
  if (body.secret !== configured) return c.json({ error: 'Invalid bootstrap secret.' }, 403)

  const existing = await listCredentialsMeta()
  const existingIds = new Set(existing.map((m) => m.officer_id))
  const allOfficers = await listOfficers()
  const toSeed = allOfficers.filter((o) => !existingIds.has(o.id))
  if (toSeed.length === 0) {
    return c.json({ error: 'All officers already have credentials. Use /api/auth/admin/reset-password instead.' }, 409)
  }

  const results: { officerId: string; name: string; email: string; tempPassword: string }[] = []
  for (const o of toSeed) {
    const email = o.email
    if (!email) continue
    const tempPassword = randomTempPassword()
    const { hash, salt, iterations } = await hashPassword(tempPassword)
    await upsertCredential(o.id, email, hash, salt, iterations, true)
    results.push({ officerId: o.id, name: o.name, email, tempPassword })
  }
  return c.json({ seeded: results.length, officers: results })
})

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

app.get('/reference', async (c) => {
  const officers = await listOfficers()
  return c.json({
    chapters: CHAPTERS,
    officers: officers.map(officerRowToPublic),
    district: DISTRICT,
    statuses: STATUS_LIST,
    workflowSteps: WORKFLOW_STEPS,
    requiredDocs: REQUIRED_DOCS,
  })
})

// ---------------------------------------------------------------------------
// Candidates — roster / detail / create / missing-report
// ---------------------------------------------------------------------------

app.get('/candidates', async (c) => {
  const officer = await currentOfficer(c)
  const denied = requireOfficer(c, officer)
  if (denied) return denied

  const { q, status, type, chapter, sort } = c.req.query()
  const allowed = allowedChapterKeysFor(officer)
  const list = await listCandidates({
    q, status, type, chapterKey: chapter, sort,
    allowedChapterKeys: allowed,
  })
  return c.json({ candidates: list })
})

app.get('/candidates/missing-report', async (c) => {
  const officer = await currentOfficer(c)
  const denied = requireOfficer(c, officer)
  if (denied) return denied

  const allowed = allowedChapterKeysFor(officer)
  const list = await listCandidates({ allowedChapterKeys: allowed, sort: 'id' })
  const rows: any[] = []
  list.forEach((cand) => {
    requiredDocsFor(cand.chapterType).forEach((d) => {
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

app.get('/candidates/csv-template', (c) => {
  const csv = buildCSVTemplate()
  return c.body(csv, 200, {
    'Content-Type': 'text/csv',
    'Content-Disposition': 'attachment; filename="apa_intake_template.csv"',
  })
})

app.post('/candidates/csv/preview', async (c) => {
  const officer = await currentOfficer(c)
  const denied = requireOfficer(c, officer)
  if (denied) return denied

  const { csv } = await c.req.json<{ csv?: string }>().catch(() => ({ csv: '' }))
  const parsed = parseCandidateCSV(csv || '')

  const existing = await Promise.all(parsed.rows.map((r) => candidateExists(String(r.id))))
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

app.post('/candidates/csv/commit', async (c) => {
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
    if (await candidateExists(String(r.id))) continue
    toInsert.push(makeCandidate(r))
  }
  await insertCandidates(toInsert)
  for (const cand of toInsert) {
    await logAudit(cand.id, officer!.id, 'csv_import', `Imported via CSV by ${officer!.name}`)
  }
  return c.json({ inserted: toInsert.length })
})

const CLEAR_ROSTER_CONFIRM_PHRASE = 'DELETE ALL CANDIDATES'

// District-tier only, irreversible: deletes every candidate record (and
// their audit history) so the roster can start clean for a fresh import.
// Requires the officer to submit an exact confirmation phrase -- this is
// the kind of action a misclick shouldn't be able to trigger.
app.post('/candidates/clear-roster', async (c) => {
  const officer = await currentOfficer(c)
  const denied = requireDistrictTier(c, officer)
  if (denied) return denied

  const body = await c.req.json<{ confirm?: string }>().catch(() => ({}) as { confirm?: string })
  if (body.confirm !== CLEAR_ROSTER_CONFIRM_PHRASE) {
    return c.json({ error: `Type "${CLEAR_ROSTER_CONFIRM_PHRASE}" exactly to confirm.` }, 400)
  }

  const cleared = await clearAllCandidates()
  await logAudit('system', officer!.id, 'clear_roster', `${officer!.name} cleared the entire roster (${cleared} candidates removed)`)
  return c.json({ cleared })
})

// Best-effort auto-fill: OCRs an uploaded Application PDF and returns parsed
// candidate fields plus the extracted headshot photo (as a data URL) so the
// Add Candidate form can pre-populate before the officer reviews/corrects it
// and submits. Nothing is persisted here -- the client re-uploads the same
// PDF (as the `application` doc) and the extracted headshot (as the
// `headshot` doc) via the existing doc-upload endpoint after the candidate
// record is actually created.
app.post('/candidates/parse-application', async (c) => {
  const officer = await currentOfficer(c)
  const denied = requireOfficer(c, officer)
  if (denied) return denied

  const form = await c.req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return c.json({ error: 'No file provided' }, 400)
  if (file.size > 25 * 1024 * 1024) return c.json({ error: 'File exceeds 25 MB limit' }, 413)

  const bytes = new Uint8Array(await file.arrayBuffer())

  let fields = {}
  try {
    fields = await parseApplicationFields(bytes, CHAPTERS)
  } catch (err) {
    console.error('parse-application: field extraction failed', err)
  }

  let headshotDataUrl: string | null = null
  try {
    const headshot = extractHeadshot(bytes)
    if (headshot) {
      headshotDataUrl = `data:${headshot.contentType};base64,${Buffer.from(headshot.bytes).toString('base64')}`
    }
  } catch (err) {
    console.error('parse-application: headshot extraction failed', err)
  }

  return c.json({ fields, headshotDataUrl })
})

app.post('/candidates', async (c) => {
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

  if (!errors.id && (await candidateExists(String(body.id).trim()))) {
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
  await insertCandidate(candidate)
  await logAudit(candidate.id, officer!.id, 'create', `Manually added by ${officer!.name}`)
  return c.json({ candidate })
})

app.get('/candidates/:id', async (c) => {
  const officer = await currentOfficer(c)
  const denied = requireOfficer(c, officer)
  if (denied) return denied

  const candidate = await getCandidate(c.req.param('id'))
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

app.post('/candidates/:id/docs/:docKey', async (c) => {
  const officer = await currentOfficer(c)
  const denied = requireOfficer(c, officer)
  if (denied) return denied

  const { id, docKey } = c.req.param()
  const candidate = await getCandidate(id)
  if (!candidate) return c.json({ error: 'Not found' }, 404)
  if (!officerCanSeeChapterKey(officer, candidate.chapterKey)) return c.json({ error: 'access_denied' }, 403)
  if (!REQUIRED_DOCS.some((d) => d.key === docKey)) return c.json({ error: 'Unknown document type' }, 400)

  const form = await c.req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return c.json({ error: 'No file provided' }, 400)
  if (file.size > 25 * 1024 * 1024) return c.json({ error: 'File exceeds 25 MB limit' }, 413)

  const originalBytes = await file.arrayBuffer()
  let bytes = originalBytes
  let contentType = file.type || 'application/octet-stream'
  let redactedCount = 0
  if (contentType === 'application/pdf') {
    try {
      const result = await redactSensitiveInfo(new Uint8Array(bytes))
      bytes = result.bytes.buffer.slice(result.bytes.byteOffset, result.bytes.byteOffset + result.bytes.byteLength) as ArrayBuffer
      redactedCount = result.redactedCount
    } catch (err) {
      // If redaction fails for any reason, fall back to storing the
      // original upload rather than blocking the officer's workflow --
      // an unredacted document beats losing the upload entirely.
      console.error('SSN redaction failed, storing original file', err)
    }
  }

  const key = `candidates/${id}/${docKey}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}`
  await putFile(key, bytes, contentType)

  const wasReplaced = !!candidate.docs[docKey]?.file
  const uploadNote = wasReplaced ? `Replaced · ${file.name} · ${(file.size / 1024).toFixed(0)} KB` : `Uploaded ${file.name} · ${(file.size / 1024).toFixed(0)} KB`
  // These four require a real signature or seal to actually be valid, which
  // isn't something OCR can reliably confirm (tried and proven unreliable on
  // real multi-column scans -- see commit history). So instead of assuming
  // they're fine, they start out flagged for officer verification; an
  // officer clears the flag once they've actually looked at it (same
  // Flag/Clear mechanism as a manually-caught problem on any other doc).
  const needsVerification = NEEDS_VERIFICATION_NOTES[docKey]
  const doc = {
    present: true,
    valid: !needsVerification,
    note: needsVerification || uploadNote,
    file: `/api/files/${key}`,
    uploadedAt: new Date().toISOString(),
  }
  let updated = await updateCandidateDoc(id, docKey, doc)

  // The Application Workflow timeline has its own separate "received" flags
  // per document -- these don't move on their own just because docs.docKey
  // changed, so every upload that has a matching step marks it done here.
  // "Received" tracks present, not valid: a doc flagged for signature
  // verification is still received.
  const workflowStepKey = WORKFLOW_STEP_FOR_DOC[docKey]
  if (workflowStepKey && updated) {
    updated = (await updateCandidateFields(id, {
      workflow: { ...updated.workflow, [workflowStepKey]: { ...(updated.workflow[workflowStepKey] || {}), done: true } },
    })) || updated
  }

  // Pull the sponsor/recommender letter text (and, failing that, at least
  // their name) plus the membership fees balance out of the application, or
  // the essay text out of the essay, for the 300-word minimum check and the
  // fees status. Runs off the original (pre-redaction) bytes -- best-effort,
  // extracted from whatever layout this upload actually has; a miss here
  // just means the word count/fees status isn't shown yet, not a blocked
  // upload.
  if (contentType === 'application/pdf' && updated) {
    const current = updated
    try {
      if (docKey === 'application') {
        const [{ sponsorName, sponsorLetter, recommenderName, recommenderLetter }, feesBalance] = await Promise.all([
          extractLetterTexts(new Uint8Array(originalBytes)),
          extractMembershipFeesBalance(new Uint8Array(originalBytes)),
        ])
        const fields: Partial<Candidate> = {}
        const attachLetter = (existing: Brother | null, name: string | undefined, letter: string | undefined, role: 'Sponsor' | 'Recommender'): Brother | undefined => {
          if (!letter) return undefined
          if (existing) return { ...existing, letter }
          if (!name) return undefined
          // No sponsor/recommender on file yet (e.g. this application was
          // uploaded before either was assigned) -- create a minimal record
          // from the letter's own heading so the letter isn't just dropped.
          return { name, chapter: 'Pending confirmation', role: 'Chapter Brother', email: '', phone: '', relationship: `${role} · Chapter Brother`, letter }
        }
        const sponsor = attachLetter(current.sponsor, sponsorName, sponsorLetter, 'Sponsor')
        const recommender = attachLetter(current.recommender, recommenderName, recommenderLetter, 'Recommender')
        const workflowUpdates: Record<string, { done: boolean; value?: string }> = {}
        if (sponsor) {
          fields.sponsor = sponsor
          workflowUpdates.sponsorAssigned = { done: true, value: `${sponsor.name} · ${countWords(sponsor.letter)} words` }
        }
        if (recommender) {
          fields.recommender = recommender
          workflowUpdates.recommenderAssigned = { done: true, value: `${recommender.name} · ${countWords(recommender.letter)} words` }
        }
        if (feesBalance !== undefined) {
          workflowUpdates.membershipFees = { done: feesBalance === 0, value: `Balance: $${feesBalance.toFixed(2)}` }
        }
        if (Object.keys(workflowUpdates).length) fields.workflow = { ...current.workflow, ...workflowUpdates }
        if (Object.keys(fields).length) updated = (await updateCandidateFields(id, fields)) || updated
      } else if (docKey === 'essay') {
        const essayText = await extractPdfText(new Uint8Array(originalBytes))
        if (essayText.trim()) updated = (await updateCandidateFields(id, { essayText })) || updated
        const words = countWords(essayText)
        const meetsMin = !!essayText.trim() && words >= MIN_ESSAY_WORDS
        const essayNote = essayText.trim()
          ? meetsMin
            ? `${words} words`
            : `Essay is ${words} words — below the ${MIN_ESSAY_WORDS}-word minimum`
          : 'Could not read the essay text automatically — please confirm it meets the 300-word minimum manually'
        const essayDoc = updated?.docs.essay || current.docs.essay
        updated = (await updateCandidateDoc(id, docKey, { ...essayDoc, valid: meetsMin, note: essayNote })) || updated
      }
    } catch (err) {
      console.error('Letter/essay/fees extraction failed', err)
    }
  }

  await logAudit(
    id,
    officer!.id,
    wasReplaced ? 'doc_replace' : 'doc_upload',
    redactedCount > 0
      ? `${docKey} by ${officer!.name} · ${redactedCount} page(s) redacted for sensitive info`
      : `${docKey} by ${officer!.name}`,
  )
  return c.json({ candidate: updated })
})

// Lets an officer mark an already-submitted document as needing correction
// (e.g. a signature that doesn't look handwritten, an expired date, a missing
// initial) -- uploading a file always marks it present+valid, since there's
// no reliable automated way to catch problems like this; this is how an
// officer who actually looked at it records that it isn't. Flipping a doc to
// invalid turns its checklist dot yellow instead of green, same as any other
// "received but not yet valid" state (see shared/seed-candidates.ts for the
// pattern this mirrors). Clearing a flag (valid: true) is the same call with
// no note.
app.post('/candidates/:id/docs/:docKey/flag', async (c) => {
  const officer = await currentOfficer(c)
  const denied = requireOfficer(c, officer)
  if (denied) return denied

  const { id, docKey } = c.req.param()
  const candidate = await getCandidate(id)
  if (!candidate) return c.json({ error: 'Not found' }, 404)
  if (!officerCanSeeChapterKey(officer, candidate.chapterKey)) return c.json({ error: 'access_denied' }, 403)
  if (!REQUIRED_DOCS.some((d) => d.key === docKey)) return c.json({ error: 'Unknown document type' }, 400)

  const existing = candidate.docs[docKey]
  if (!existing?.present) return c.json({ error: 'Document has not been submitted yet' }, 400)

  const body = await c.req.json().catch(() => null)
  if (!body || typeof body.valid !== 'boolean') return c.json({ error: 'valid (boolean) is required' }, 400)
  const note = typeof body.note === 'string' ? body.note.trim() : ''
  if (!body.valid && !note) return c.json({ error: 'A reason is required to flag a document' }, 400)

  const doc = {
    ...existing,
    valid: body.valid,
    note: body.valid ? null : note,
  }
  const updated = await updateCandidateDoc(id, docKey, doc)
  await logAudit(
    id,
    officer!.id,
    body.valid ? 'doc_unflag' : 'doc_flag',
    body.valid ? `${docKey} cleared by ${officer!.name}` : `${docKey} flagged by ${officer!.name} · ${note}`,
  )
  return c.json({ candidate: updated })
})

// Lets an officer directly mark membership fees paid/unpaid, independent of
// (or overriding) whatever the OCR'd application balance said -- fees can
// clear through a channel the application PDF doesn't reflect, or the
// balance line might not have been readable on a given upload.
app.post('/candidates/:id/workflow/membership-fees', async (c) => {
  const officer = await currentOfficer(c)
  const denied = requireOfficer(c, officer)
  if (denied) return denied

  const { id } = c.req.param()
  const candidate = await getCandidate(id)
  if (!candidate) return c.json({ error: 'Not found' }, 404)
  if (!officerCanSeeChapterKey(officer, candidate.chapterKey)) return c.json({ error: 'access_denied' }, 403)

  const body = await c.req.json().catch(() => null)
  if (!body || typeof body.paid !== 'boolean') return c.json({ error: 'paid (boolean) is required' }, 400)

  const updated = await updateCandidateFields(id, {
    workflow: {
      ...candidate.workflow,
      membershipFees: { done: body.paid, value: body.paid ? `Paid · marked by ${officer!.name}` : 'Not yet paid' },
    },
  })
  await logAudit(id, officer!.id, body.paid ? 'fees_paid' : 'fees_unpaid', `Membership fees marked ${body.paid ? 'paid' : 'unpaid'} by ${officer!.name}`)
  return c.json({ candidate: updated })
})

app.get('/files/*', async (c) => {
  const key = c.req.path.replace(/^\/api\/files\//, '')
  const file = await getFile(key)
  if (!file) return c.notFound()
  return new Response(file.body, {
    headers: {
      'Content-Type': file.contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  })
})

export default app
