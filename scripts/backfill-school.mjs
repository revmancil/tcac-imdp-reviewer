#!/usr/bin/env node
// One-time backfill: corrects the `school` field on existing collegiate
// candidates to match their chapter's actual school (e.g. Delta Theta ->
// Texas Southern University), for records created before makeCandidate()
// started deriving it automatically. Alumni candidates are left untouched
// -- alumni chapters have no fixed school.
//
// Safe to run more than once: only writes rows that are actually wrong.
//
// Usage:
//   npm run db:backfill-school -- --dry-run   (preview only, no writes)
//   npm run db:backfill-school                (apply the changes)

import { config as loadEnv } from 'dotenv'
import postgres from 'postgres'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.join(__dirname, '..')

// Same .env.local-then-.env loading as scripts/migrate.mjs, so this reads
// the same DATABASE_URL `vercel dev` / db:migrate would.
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

const { CHAPTERS } = await import('../shared/reference.ts')

const sql = postgres(databaseUrl, { prepare: false, ssl: 'require' })

async function main() {
  const rows = await sql`
    SELECT id, name, chapter_key, school, data
    FROM candidates
    WHERE chapter_type = 'collegiate'
    ORDER BY id
  `

  let fixed = 0
  let skippedUnknownChapter = 0
  let alreadyCorrect = 0

  for (const row of rows) {
    const chapter = CHAPTERS[row.chapter_key]
    if (!chapter || chapter.type !== 'collegiate' || !chapter.school) {
      skippedUnknownChapter++
      console.log(`skip  ${row.id} (${row.name}) -- unknown or schoolless chapter "${row.chapter_key}"`)
      continue
    }

    if (row.school === chapter.school) {
      alreadyCorrect++
      continue
    }

    console.log(`${dryRun ? '[dry-run] ' : ''}fix   ${row.id} (${row.name}): "${row.school}" -> "${chapter.school}"`)
    fixed++

    if (!dryRun) {
      const data = JSON.parse(row.data)
      data.school = chapter.school
      await sql`
        UPDATE candidates
        SET school = ${chapter.school}, data = ${JSON.stringify(data)}
        WHERE id = ${row.id}
      `
    }
  }

  console.log('')
  console.log(`${rows.length} collegiate candidates checked.`)
  console.log(`${fixed} ${dryRun ? 'would be fixed' : 'fixed'}, ${alreadyCorrect} already correct, ${skippedUnknownChapter} skipped (unknown chapter).`)
  if (dryRun && fixed > 0) console.log('\nRe-run without --dry-run to apply these changes.')

  await sql.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
