// Best-effort extraction of candidate fields + headshot photo from an
// uploaded Application PDF, to pre-fill the Add Candidate form.
//
// The real reference application (public/static/pdfs/2897040/Application.pdf)
// has no usable text layer -- it's a printed/exported screenshot from
// another system, not a fillable PDF form (confirmed with pdf.js, poppler,
// and mupdf: all three return garbage/empty text). So this renders pages to
// images and OCRs them, rather than reading embedded text directly.
//
// The form layout is a consistent "Label" line followed by a "Value" line
// (a boxed input under a caption) -- see the header block for Name/Chapter/
// Email/Classification/DOB/Sponsor/Recommender, and the field sections below
// it for the rest. This is a heuristic, best-effort parse: the officer
// reviews and can correct every field before the candidate record is
// created (same pattern as the existing CSV import preview).
import * as mupdf from 'mupdf'
import { createWorker } from 'tesseract.js'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeName } from '../../shared/names.js'
import type { Chapter } from '../../shared/types.js'

// By default tesseract.js fetches its English language model (~3MB) from
// cdn.jsdelivr.net on every worker creation -- fine on a long-running
// server, but a real cost on Vercel: a cold function pays that network
// round-trip (DNS + TLS + transfer) before OCR can even start, on top of
// the OCR itself, and every application upload creates 2-4 separate
// workers (parse-for-preview, then letters/fees/essay once the doc is
// actually uploaded). tessdata/eng.traineddata.gz (bundled via vercel.json
// includeFiles) lets each worker load it from local disk instead -- no
// network call at all. TESSERACT_LANG_PATH overrides this if ever needed
// (e.g. pointing at a different self-hosted copy); otherwise it's automatic.
// Resolved relative to this file's own location, which differs depending on
// how it's running: two levels up from the unbundled source (src/lib/), but
// only one level up from the esbuild-bundled production output (api/
// handler.js -- see package.json build:api). Trying both rather than
// hardcoding one keeps this correct in both without the build needing to
// know anything about it.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BUNDLED_TESSDATA_DIR = [path.join(__dirname, '../tessdata'), path.join(__dirname, '../../tessdata')].find((dir) =>
  existsSync(path.join(dir, 'eng.traineddata.gz'))
)
const DEFAULT_LANG_PATH = process.env.TESSERACT_LANG_PATH || BUNDLED_TESSDATA_DIR

function workerOptions() {
  // cachePath separate from langPath: langPath is the bundled, read-only
  // copy; /tmp is the one writable location in a Vercel function, so a
  // warm container that reuses the same instance can skip the gunzip on
  // every subsequent worker too (a failed write here -- e.g. running
  // somewhere /tmp isn't available -- is caught internally by tesseract.js
  // and just means no cross-call caching, not a broken worker).
  return DEFAULT_LANG_PATH ? { langPath: DEFAULT_LANG_PATH, cachePath: '/tmp', gzip: true } : undefined
}

export interface ParsedApplicationFields {
  id?: string
  firstName?: string
  middleName?: string
  lastName?: string
  email?: string
  phone?: string
  address?: string
  dob?: string
  school?: string
  major?: string
  classification?: string
  gpa?: string
  gradDate?: string
  chapterKey?: string
  sponsorName?: string
  recommenderName?: string
}

export interface ExtractedHeadshot {
  bytes: Uint8Array
  contentType: string
}

// ---------------------------------------------------------------------------
// Headshot extraction -- pulled directly from the PDF's embedded images,
// no OCR involved. The headshot is identified by shape: real photos are
// roughly square-ish and reasonably large, unlike the page's decorative
// hairline-rule graphics (very wide, ~1-3px tall) or small checkbox/dropdown
// icons (under ~30px square).
// ---------------------------------------------------------------------------

function findHeadshotOnPage(page: mupdf.PDFPage): ExtractedHeadshot | null {
  const resources = page.getObject().get('Resources')
  const xobjects = resources.get('XObject')
  if (xobjects.isNull()) return null

  const candidates: { obj: mupdf.PDFObject; width: number; height: number }[] = []
  xobjects.forEach((val: mupdf.PDFObject) => {
    if (!val.isStream()) return
    if (val.get('Subtype').asName() !== 'Image') return
    const width = val.get('Width').asNumber()
    const height = val.get('Height').asNumber()
    if (!width || !height) return
    const ratio = width / height
    if (width < 80 || height < 80 || ratio < 0.6 || ratio > 1.8) return
    candidates.push({ obj: val, width, height })
  })
  const best = candidates.sort((a, b) => b.width * b.height - a.width * a.height)[0]
  if (!best) return null

  // Real embedded photos are essentially always JPEG (DCTDecode) -- pull the
  // raw stream directly with zero re-encoding. Other filters (raw Flate-
  // compressed samples, JPEG2000, ...) would need reconstructing a Pixmap
  // from decoded samples + colorspace + bit depth, which isn't worth the
  // complexity for what would be a rare case for an actual photograph; skip
  // gracefully instead (the officer can still attach a headshot manually).
  const filter = best.obj.get('Filter')
  if (!filter.isName() || filter.asName() !== 'DCTDecode') return null

  const raw = best.obj.readRawStream()
  return { bytes: raw.asUint8Array(), contentType: 'image/jpeg' }
}

export function extractHeadshot(pdfBytes: Uint8Array): ExtractedHeadshot | null {
  const doc = mupdf.Document.openDocument(pdfBytes, 'application/pdf') as mupdf.PDFDocument
  const pageCount = Math.min(doc.countPages(), 3)
  for (let i = 0; i < pageCount; i++) {
    const found = findHeadshotOnPage(doc.loadPage(i) as mupdf.PDFPage)
    if (found) return found
  }
  return null
}

// ---------------------------------------------------------------------------
// Batch upload -- splits one combined PDF (several applications concatenated
// back-to-back) into standalone per-application PDFs, one per fixed-size
// page window. Each application is always `pagesPerApplication` pages (see
// REQUIRED_DOCS['application'].pages in shared/reference.ts) in every real
// sample seen -- the same assumption extractLetterTexts/
// extractMembershipFeesBalance already make about a single application's
// own internal layout (e.g. the letters living on "page 5"). A combined PDF
// whose page count isn't a clean multiple of it still produces a trailing
// short chunk rather than silently dropping pages; that chunk's own field
// extraction will come up short (no ID found, etc.) and the caller's normal
// per-row error handling surfaces it for review rather than guessing.
// ---------------------------------------------------------------------------

export interface PdfChunk {
  bytes: Uint8Array
  startPage: number
  pageCount: number
}

export function splitPdfIntoApplicationChunks(pdfBytes: Uint8Array, pagesPerApplication: number): PdfChunk[] {
  const srcDoc = mupdf.Document.openDocument(pdfBytes, 'application/pdf') as mupdf.PDFDocument
  const totalPages = srcDoc.countPages()
  const chunks: PdfChunk[] = []
  for (let start = 0; start < totalPages; start += pagesPerApplication) {
    const end = Math.min(start + pagesPerApplication, totalPages)
    const out = new mupdf.PDFDocument()
    for (let i = start; i < end; i++) {
      out.graftPage(i - start, srcDoc, i)
    }
    // .asUint8Array() is a view into mupdf's WASM heap, not an independent
    // copy -- it goes stale (byteLength 0, "detached ArrayBuffer") the next
    // time that WASM memory grows, which any later mupdf call (the next
    // chunk's own graftPage/saveToBuffer, or this chunk's own OCR pass
    // re-opening it) can trigger. Copy it out now, while it's still valid,
    // so each chunk is a real, independent buffer the caller can hold onto
    // and reuse (e.g. parseApplicationFields then extractHeadshot on the
    // same bytes) without it dying out from under them.
    const view = out.saveToBuffer(undefined).asUint8Array()
    chunks.push({ bytes: new Uint8Array(view), startPage: start, pageCount: end - start })
  }
  return chunks
}

// ---------------------------------------------------------------------------
// Field extraction via OCR -- render the first couple of pages (everything
// we need lives there) and read the text line-by-line.
// ---------------------------------------------------------------------------

async function renderPageToPNG(doc: mupdf.Document, pageIndex: number, gamma?: number): Promise<Uint8Array> {
  const page = doc.loadPage(pageIndex)
  const matrix = mupdf.Matrix.scale(2, 2)
  const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true)
  if (gamma) pixmap.gamma(gamma)
  return pixmap.asPNG()
}

async function ocrLines(worker: Awaited<ReturnType<typeof createWorker>>, png: Uint8Array): Promise<string[]> {
  const { data } = await worker.recognize(Buffer.from(png))
  return data.text.split('\n').map((l) => l.trim()).filter(Boolean)
}

// Known "Label" lines mapped to a setter for the field that follows them.
// The value is only used if the *next* OCR'd line isn't itself one of these
// labels (an empty field on this layout just skips straight to the next
// label with no blank placeholder line).
const LABEL_SETTERS: [string, (fields: ParsedApplicationFields, value: string) => void][] = [
  ['First Name', (f, v) => (f.firstName = v)],
  ['Middle Name', (f, v) => (f.middleName = v)],
  ['Last Name', (f, v) => (f.lastName = v)],
  ['Email', (f, v) => (f.email = v)],
  ['Mobile/Primary', (f, v) => (f.phone = v)],
  ['Class', (f, v) => (f.classification = /alum/i.test(v) ? 'Alumni' : 'Undergraduate')],
  ['GPA', (f, v) => (f.gpa = normalizeGPA(v))],
  ['Bachelor University', (f, v) => (f.school = v)],
  ['College Major', (f, v) => (f.major = v.replace(/\s*\(Minor\)\s*$/i, ''))],
  ['Graduation Year', (f, v) => (f.gradDate = v)],
]

// OCR frequently drops the decimal point out of a small "X.XX" GPA value
// (e.g. "3.50" -> "350"). If we get a bare 3-digit number in a plausible
// GPA*100 range, put the decimal back rather than passing "350" through.
function normalizeGPA(raw: string): string {
  if (/^\d{3}$/.test(raw)) {
    const asHundredths = parseInt(raw, 10)
    if (asHundredths >= 150 && asHundredths <= 450) return (asHundredths / 100).toFixed(2)
  }
  return raw
}

const norm = (s: string) => s.trim().toLowerCase()

function parseLabelValueLines(lines: string[], fields: ParsedApplicationFields) {
  const labelTexts = new Set(LABEL_SETTERS.map(([label]) => norm(label)))
  for (let i = 0; i < lines.length; i++) {
    const match = LABEL_SETTERS.find(([label]) => norm(lines[i]) === norm(label))
    if (!match) continue
    const next = lines[i + 1]
    if (next && !labelTexts.has(norm(next))) match[1](fields, next)
  }
}

function parseAddressLines(lines: string[], fields: ParsedApplicationFields) {
  const valueAfter = (label: string) => {
    const i = lines.findIndex((l) => norm(l) === norm(label))
    return i >= 0 && lines[i + 1] ? lines[i + 1] : ''
  }
  const street = valueAfter('Street Address')
  const city = valueAfter('City')
  // The state field is a dropdown right next to a small arrow icon, which
  // OCR often mangles into unrelated symbols -- only trust it if it actually
  // looks like a US state abbreviation, rather than inserting garbage.
  const rawState = valueAfter('State')
  const state = /^[A-Z]{2}$/i.test(rawState.trim()) ? rawState.trim().toUpperCase() : ''
  const zip = valueAfter('Zip Code')
  if (street || city || state || zip) {
    fields.address = [street, [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')]
      .filter(Boolean)
      .join(', ')
  }
}

function parseHeaderBlock(fullText: string, fields: ParsedApplicationFields, chapters: Record<string, Chapter>) {
  // The header's meta block has a line like "Candidate 2897040" -- distinct
  // from checklist lines like "Candidate Resume Uploaded" since those never
  // have a run of digits right after "Candidate".
  const idMatch = fullText.match(/\bCandidate\s+(\d{4,})\b/i)
  if (idMatch) fields.id = idMatch[1]

  const bornMatch = fullText.match(/Born in (\d{4})/i)
  if (bornMatch) fields.dob = bornMatch[1]

  const sponsorMatch = fullText.match(/Sponsor:\s*([^\n]+)/i)
  if (sponsorMatch) fields.sponsorName = reverseNameToDisplay(sponsorMatch[1])

  const recommenderMatch = fullText.match(/Recommender:\s*([^\n]+)/i)
  if (recommenderMatch) fields.recommenderName = reverseNameToDisplay(recommenderMatch[1])

  // Chapter: look for any known chapter's full name appearing in the text.
  // Longest names first so e.g. "Alpha" doesn't shadow "Alpha Sigma".
  const byNameLength = Object.values(chapters).sort((a, b) => b.name.length - a.name.length)
  for (const ch of byNameLength) {
    if (ch.name.length < 4) continue
    const re = new RegExp(`\\b${ch.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    if (re.test(fullText)) {
      fields.chapterKey = ch.key
      break
    }
  }
}

// "Sibley, Roderick L." -> "Bro. Roderick L. Sibley"
function reverseNameToDisplay(raw: string): string {
  const normalized = normalizeName(raw)
  return normalized.startsWith('Bro.') ? normalized : `Bro. ${normalized}`
}

// ---------------------------------------------------------------------------
// Sponsor/recommender letter text + essay text -- for the district's
// 300-word minimum check. Both live inside the reference application's page
// 5 layout, each introduced by a "Sponsor: <name>" / "Recommender: <name>"
// heading (see the reference Application.pdf) -- the letter body is
// everything between its own heading and the next one.
// ---------------------------------------------------------------------------

export interface ExtractedLetters {
  sponsorName?: string
  sponsorLetter?: string
  recommenderName?: string
  recommenderLetter?: string
}

const clean = (s: string) => s.trim().replace(/\s+/g, ' ')

export async function extractLetterTexts(pdfBytes: Uint8Array): Promise<ExtractedLetters> {
  const doc = mupdf.Document.openDocument(pdfBytes, 'application/pdf')
  const pageCount = doc.countPages()
  // The letters live on page 5 of the reference layout (index 4). Guard
  // against shorter applications rather than assuming every upload matches.
  const pageIndex = 4
  if (pageIndex >= pageCount) return {}

  const worker = await createWorker('eng', 1, workerOptions())
  try {
    const png = await renderPageToPNG(doc, pageIndex)
    const { data } = await worker.recognize(Buffer.from(png))
    const text = data.text

    // Each heading is "Sponsor: <Name>" / "Recommender: <Name>" -- capture
    // the name here too (not just page 1's header block) so a letter can
    // still be attached even if the candidate has no sponsor/recommender
    // on file yet (e.g. the application was uploaded before either was
    // assigned).
    const sponsorMatch = text.match(/Sponsor:\s*([^\n]*)\n/i)
    const recommenderMatch = text.match(/Recommender:\s*([^\n]*)\n/i)

    const result: ExtractedLetters = {}
    if (sponsorMatch) {
      const start = sponsorMatch.index! + sponsorMatch[0].length
      const end = recommenderMatch ? recommenderMatch.index! : text.length
      const body = clean(text.slice(start, end))
      if (body) result.sponsorLetter = body
      if (sponsorMatch[1].trim()) result.sponsorName = reverseNameToDisplay(sponsorMatch[1])
    }
    if (recommenderMatch) {
      const start = recommenderMatch.index! + recommenderMatch[0].length
      const body = clean(text.slice(start))
      if (body) result.recommenderLetter = body
      if (recommenderMatch[1].trim()) result.recommenderName = reverseNameToDisplay(recommenderMatch[1])
    }
    return result
  } finally {
    await worker.terminate()
  }
}

// The application's own status page already states the fees balance as
// "Membership Fees (Bal: $X.XX)" -- read directly off page 1, rather than
// requiring a separate "Financial Commitment Form" upload. A balance of
// $0.00 means fees are paid; anything above that means they're still
// pending.
const MEMBERSHIP_FEES_RE = /Membership Fees\s*\(?\s*Bal(?:ance)?:?\s*\$?\s*([\d,]+\.\d{2})\)?/i

export async function extractMembershipFeesBalance(pdfBytes: Uint8Array): Promise<number | undefined> {
  const doc = mupdf.Document.openDocument(pdfBytes, 'application/pdf')
  const worker = await createWorker('eng', 1, workerOptions())
  try {
    const png = await renderPageToPNG(doc, 0)
    const { data } = await worker.recognize(Buffer.from(png))
    const match = data.text.match(MEMBERSHIP_FEES_RE)
    return match ? parseFloat(match[1].replace(/,/g, '')) : undefined
  } finally {
    await worker.terminate()
  }
}

// Full OCR'd text of every page of a PDF, in reading order -- used for the
// candidate essay, which (unlike the application) has no other fields worth
// parsing out of it.
export async function extractPdfText(pdfBytes: Uint8Array): Promise<string> {
  const doc = mupdf.Document.openDocument(pdfBytes, 'application/pdf')
  const pageCount = doc.countPages()

  const worker = await createWorker('eng', 1, workerOptions())
  try {
    const parts: string[] = []
    for (let i = 0; i < pageCount; i++) {
      const png = await renderPageToPNG(doc, i)
      const { data } = await worker.recognize(Buffer.from(png))
      const text = data.text.trim()
      if (text) parts.push(text)
    }
    return parts.join('\n\n')
  } finally {
    await worker.terminate()
  }
}

export async function parseApplicationFields(
  pdfBytes: Uint8Array,
  chapters: Record<string, Chapter>
): Promise<ParsedApplicationFields> {
  const doc = mupdf.Document.openDocument(pdfBytes, 'application/pdf')
  const pageCount = Math.min(doc.countPages(), 2)

  const worker = await createWorker('eng', 1, workerOptions())
  try {
    const fields: ParsedApplicationFields = {}
    let combinedText = ''
    for (let i = 0; i < pageCount; i++) {
      const png = await renderPageToPNG(doc, i)
      const lines = await ocrLines(worker, png)
      combinedText += '\n' + lines.join('\n')
      parseLabelValueLines(lines, fields)
      parseAddressLines(lines, fields)
    }
    parseHeaderBlock(combinedText, fields, chapters)

    // The Candidate ID lives in a low-contrast gray metadata line that a
    // normal OCR pass skips entirely (reads as if it weren't there). A
    // second, gamma-boosted pass over just the first page recovers it --
    // deliberately kept separate from the main pass above, since the same
    // boost that reveals this text also introduces enough noise elsewhere
    // to corrupt several other fields that already read cleanly without it.
    if (!fields.id) {
      const boostedPng = await renderPageToPNG(doc, 0, 2.5)
      const boostedLines = await ocrLines(worker, boostedPng)
      const idMatch = boostedLines.join('\n').match(/\bCandidate\s+(\d{4,})\b/i)
      if (idMatch) fields.id = idMatch[1]
    }

    return fields
  } finally {
    await worker.terminate()
  }
}
