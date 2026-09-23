// Detects and permanently redacts Social Security Numbers (and similar
// sensitive identifiers) found visually in an uploaded PDF -- via OCR, since
// the underlying text (if any) can't be trusted to exist or be accurate (see
// pdf-parse.ts for why: the reference application has no usable text layer
// at all). Runs on every PDF upload before it's stored, so a redacted
// document is the only version that ever gets saved.
//
// Uses mupdf's native PDF redaction (Redact annotations + applyRedactions):
// this actually removes the underlying content under the marked area, not
// just draws a box over it, and burns in a black box in its place.
import * as mupdf from 'mupdf'
import { createWorker } from 'tesseract.js'

// Full SSN with the standard AAA-GG-SSSS hyphenation -- a distinctive enough
// shape that it's very unlikely to collide with other 9-digit-ish data
// (phone numbers group as AAA-AAA-AAAA, ZIP+4 as AAAAA-AAAA).
const STRICT_SSN = /\b\d{3}-\d{2}-\d{4}\b/g

// Looser digit-run variants (hyphens misread as spaces/dropped, or no
// hyphens at all) -- only treated as sensitive when "SSN" or "Social
// Security" appears on the same line, so this stays narrow.
const LOOSE_SSN = /\b(\d{3}[\s-]\d{2}[\s-]\d{4}|\d{9})\b/g
const SSN_LABEL = /\bSSN\b|\bSocial Security\b/i

interface TextMatch {
  start: number
  end: number
}

function findSensitiveSpans(lineText: string): TextMatch[] {
  const matches: TextMatch[] = []
  for (const m of lineText.matchAll(STRICT_SSN)) {
    matches.push({ start: m.index!, end: m.index! + m[0].length })
  }
  if (SSN_LABEL.test(lineText)) {
    for (const m of lineText.matchAll(LOOSE_SSN)) {
      const start = m.index!
      const end = start + m[0].length
      if (!matches.some((x) => start < x.end && end > x.start)) matches.push({ start, end })
    }
  }
  return matches
}

interface WordBox {
  text: string
  x0: number
  y0: number
  x1: number
  y1: number
}

// Reconstructs a line's text the same way it's matched against (words
// joined by single spaces) so character offsets from the regex map back
// to exactly the right words, then unions the bboxes of whichever words
// overlap a given [start, end) match range.
function unionBoxForSpan(words: WordBox[], span: TextMatch): WordBox | null {
  let cursor = 0
  let box: WordBox | null = null
  for (const w of words) {
    const start = cursor
    const end = start + w.text.length
    cursor = end + 1 // +1 for the joining space
    if (start < span.end && end > span.start) {
      box = box
        ? { text: '', x0: Math.min(box.x0, w.x0), y0: Math.min(box.y0, w.y0), x1: Math.max(box.x1, w.x1), y1: Math.max(box.y1, w.y1) }
        : { ...w }
    }
  }
  return box
}

const RENDER_SCALE = 2
const PAD_PT = 2 // small margin so redaction fully covers the text, not just its measured box

async function redactPage(doc: mupdf.PDFDocument, pageIndex: number, worker: Awaited<ReturnType<typeof createWorker>>): Promise<boolean> {
  const page = doc.loadPage(pageIndex) as mupdf.PDFPage
  const bounds = page.getBounds()
  const pageHeight = bounds[3] - bounds[1]

  const matrix = mupdf.Matrix.scale(RENDER_SCALE, RENDER_SCALE)
  const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true)
  const png = pixmap.asPNG()

  const { data } = await worker.recognize(Buffer.from(png), {}, { blocks: true })

  let found = false
  for (const block of data.blocks || []) {
    for (const para of block.paragraphs || []) {
      for (const line of para.lines || []) {
        const words: WordBox[] = (line.words || []).map((w: any) => ({ text: w.text, x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 }))
        if (!words.length) continue
        const lineText = words.map((w) => w.text).join(' ')
        const spans = findSensitiveSpans(lineText)
        for (const span of spans) {
          const box = unionBoxForSpan(words, span)
          if (!box) continue
          found = true
          const rect: mupdf.Rect = [
            box.x0 / RENDER_SCALE - PAD_PT,
            pageHeight - box.y1 / RENDER_SCALE - PAD_PT,
            box.x1 / RENDER_SCALE + PAD_PT,
            pageHeight - box.y0 / RENDER_SCALE + PAD_PT,
          ]
          const annot = page.createAnnotation('Redact')
          annot.setRect(rect)
          // applyRedactions() actually reads /QuadPoints to determine what
          // to black out, not /Rect (confirmed empirically -- Rect alone
          // silently redacts the wrong area). There's no setQuadPoints() in
          // the JS bindings, so it's written directly via the raw PDF
          // object. Vertex order per spec: upper-left, upper-right,
          // lower-left, lower-right.
          const quadPoints = doc.newArray()
          for (const v of [rect[0], rect[3], rect[2], rect[3], rect[0], rect[1], rect[2], rect[1]]) {
            quadPoints.push(v)
          }
          annot.getObject().put('QuadPoints', quadPoints)
          annot.update()
        }
      }
    }
  }

  if (found) {
    page.applyRedactions(true, mupdf.PDFPage.REDACT_IMAGE_PIXELS, mupdf.PDFPage.REDACT_LINE_ART_REMOVE_IF_TOUCHED, mupdf.PDFPage.REDACT_TEXT_REMOVE)
  }
  return found
}

export interface RedactionResult {
  bytes: Uint8Array
  redactedCount: number
}

// Returns the (possibly modified) PDF bytes plus how many redactions were
// applied. If nothing sensitive was found, `bytes` is still a valid PDF --
// mupdf re-saves it either way, which is harmless.
export async function redactSensitiveInfo(pdfBytes: Uint8Array): Promise<RedactionResult> {
  const doc = mupdf.Document.openDocument(pdfBytes, 'application/pdf') as mupdf.PDFDocument
  const pageCount = doc.countPages()

  const langPath = process.env.TESSERACT_LANG_PATH
  const worker = await createWorker('eng', 1, langPath ? { langPath, cachePath: langPath, gzip: true } : undefined)
  let redactedCount = 0
  try {
    for (let i = 0; i < pageCount; i++) {
      if (await redactPage(doc, i, worker)) redactedCount++
    }
  } finally {
    await worker.terminate()
  }

  const buffer = doc.saveToBuffer('')
  return { bytes: buffer.asUint8Array(), redactedCount }
}
