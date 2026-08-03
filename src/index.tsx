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
  officerIdForEmail,
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
} from './lib/db'
import { makeCandidate, parseCandidateCSV, buildCSVTemplate } from './lib/candidate-factory'

export type Bindings = {
  DB: D1Database
  UPLOADS: R2Bucket
  SESSION_SECRET?: string
  ASSETS: Fetcher
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

function secretOf(env: Bindings): string {
  return env.SESSION_SECRET || 'dev-secret-texas-district-intake-do-not-use-in-real-prod'
}

async function currentOfficer(c: any): Promise<OfficerPublic | null> {
  const id = await readSession(c, secretOf(c.env))
  if (!id) return null
  return OFFICERS[id] || null
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
  const body = await c.req.json<{ email?: string }>().catch(() => ({}))
  const email = (body.email || '').trim()
  const officerId = officerIdForEmail(email)
  if (!officerId) {
    return c.json({ error: 'No account found with that email. Try one of the officer email formats below (e.g. escalante@apa-texas.org, tanner@apa-texas.org).' }, 401)
  }
  await setSession(c, secretOf(c.env), officerId)
  return c.json({ officer: OFFICERS[officerId] })
})

// Demo directory quick sign-in (mirrors the design's clickable officer cards).
app.post('/api/auth/quick-signin', async (c) => {
  const body = await c.req.json<{ officerId?: string }>().catch(() => ({}))
  const officer = body.officerId ? OFFICERS[body.officerId] : null
  if (!officer) return c.json({ error: 'Unknown officer' }, 400)
  await setSession(c, secretOf(c.env), officer.id)
  return c.json({ officer })
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
