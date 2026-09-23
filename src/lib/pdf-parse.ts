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
import type { Chapter } from '../../shared/types.js'

export interface ParsedApplicationFields {
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
// Field extraction via OCR -- render the first couple of pages (everything
// we need lives there) and read the text line-by-line.
// ---------------------------------------------------------------------------

async function renderPageToPNG(doc: mupdf.Document, pageIndex: number): Promise<Uint8Array> {
  const page = doc.loadPage(pageIndex)
  const matrix = mupdf.Matrix.scale(2, 2)
  const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true)
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
  const clean = raw.trim().replace(/\s+/g, ' ')
  const [last, rest] = clean.split(',').map((s) => s.trim())
  if (!last || !rest) return clean.startsWith('Bro.') ? clean : `Bro. ${clean}`
  return `Bro. ${rest} ${last}`
}

export async function parseApplicationFields(
  pdfBytes: Uint8Array,
  chapters: Record<string, Chapter>
): Promise<ParsedApplicationFields> {
  const doc = mupdf.Document.openDocument(pdfBytes, 'application/pdf')
  const pageCount = Math.min(doc.countPages(), 2)

  // By default tesseract.js fetches its English language model from a CDN
  // on first use per cold start. That's fine on Vercel (normal outbound
  // internet access), but TESSERACT_LANG_PATH lets it be pointed at a
  // self-hosted/bundled copy instead, if the CDN ever proves unreliable.
  const langPath = process.env.TESSERACT_LANG_PATH
  const worker = await createWorker('eng', 1, langPath ? { langPath, cachePath: langPath, gzip: true } : undefined)
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
    return fields
  } finally {
    await worker.terminate()
  }
}
