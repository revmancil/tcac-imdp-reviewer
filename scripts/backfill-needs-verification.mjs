#!/usr/bin/env node
// One-time backfill: fixes docs that are stuck in the automatic "awaiting
// officer verification" state (transcript / enrollmentLetter / medical /
// nda -- see NEEDS_VERIFICATION_NOTES in src/index.tsx) but predate the
// `needsVerification` flag that distinguishes that state from an actual
// officer-caught problem.
//
// Without this flag, computeRecommendedStatus (shared/reference.ts) can't
// tell "just uploaded, nobody's looked at it yet" apart from "an officer
// flagged a real issue" -- both are present:true, valid:false. That made it
// recommend (and, if applied, actually set) "Missing Docs" for candidates
// whose documents were all there and simply hadn't been verified yet.
//
// This only repairs the doc data (adds needsVerification: true where the
// note still matches the untouched auto-generated text). It deliberately
// does NOT touch `status` -- once a candidate's docs are fixed, the Detail
// page will show a fresh "Recommended: ..." banner for an officer to review
// and apply themselves, same as any other status change.
//
// Safe to run more than once: only writes docs that still match the
// original auto-generated note exactly (an officer clearing or re-flagging
// a doc already changes the note, so already-reviewed docs are untouched).
//
// Usage:
//   npm run db:backfill-needs-verification -- --dry-run   (preview only)
//   npm run db:backfill-needs-verification                (apply)

import { config as loadEnv } from 'dotenv'
import postgres from 'postgres'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(__dirname, '..')

for (const file of ['.env.local', '.env']) {
  const p = path.join(projectRoot, file)
  if (existsSync(p)) {
    loadEnv({ path: p })
    break
  }
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Add it to .env or .env.local -- see .env.example.')
  process.exit(1)
}

const dryRun = process.argv.includes('--dry-run')

// Mirrors NEEDS_VERIFICATION_NOTES in src/index.tsx -- kept in sync by hand
// since this is a one-time script, not shared runtime code.
const NEEDS_VERIFICATION_NOTES = {
  transcript: 'Needs officer verification: must include a signature or the school seal.',
  enrollmentLetter: 'Needs officer verification: must be signed by the Office of the Registrar.',
  medical: 'Needs officer verification: must be signed by both the candidate and the physician.',
  nda: 'Needs officer verification: must be signed by the candidate, and by a parent/guardian if the candidate is under 18.',
}

const sql = postgres(databaseUrl, { prepare: false, ssl: 'require' })

async function main() {
  const rows = await sql`SELECT id, name, data FROM candidates ORDER BY id`

  let candidatesFixed = 0
  let docsFixed = 0

  for (const row of rows) {
    const data = JSON.parse(row.data)
    const docs = data.docs || {}
    let changed = false

    for (const [docKey, expectedNote] of Object.entries(NEEDS_VERIFICATION_NOTES)) {
      const doc = docs[docKey]
      if (!doc || !doc.present || doc.valid !== false) continue
      if (doc.needsVerification === true) continue // already fixed
      if (doc.note !== expectedNote) continue // officer already touched it -- leave alone

      console.log(`${dryRun ? '[dry-run] ' : ''}fix   ${row.id} (${row.name}): ${docKey} -> needsVerification: true`)
      doc.needsVerification = true
      changed = true
      docsFixed++
    }

    if (changed) {
      candidatesFixed++
      if (!dryRun) {
        await sql`UPDATE candidates SET data = ${JSON.stringify(data)} WHERE id = ${row.id}`
      }
    }
  }

  console.log('')
  console.log(`${rows.length} candidates checked.`)
  console.log(`${docsFixed} doc(s) across ${candidatesFixed} candidate(s) ${dryRun ? 'would be fixed' : 'fixed'}.`)
  if (dryRun && docsFixed > 0) console.log('\nRe-run without --dry-run to apply these changes.')
  console.log('\nAffected candidates will show a fresh "Recommended: ..." banner on their Detail page -- review and Apply each one to correct its actual status.')

  await sql.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
