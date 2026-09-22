#!/usr/bin/env node
// Applies migrations/*.sql to the Postgres database at DATABASE_URL, in
// filename order, tracking what's already been applied in a `_migrations`
// table. Safe to run repeatedly — already-applied files are skipped.
//
// Usage: npm run db:migrate   (reads DATABASE_URL from .env / .env.local)

import 'dotenv/config'
import postgres from 'postgres'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.join(__dirname, '..', 'migrations')

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Add it to .env or .env.local — see .env.example.')
  process.exit(1)
}

const sql = postgres(databaseUrl, { prepare: false, ssl: 'require' })

async function main() {
  await sql`CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`

  const applied = new Set((await sql`SELECT name FROM _migrations`).map((r) => r.name))
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip  ${file} (already applied)`)
      continue
    }
    const contents = readFileSync(path.join(migrationsDir, file), 'utf8')
    console.log(`apply ${file}`)
    await sql.begin(async (tx) => {
      await tx.unsafe(contents)
      await tx`INSERT INTO _migrations (name) VALUES (${file})`
    })
  }

  console.log('Done.')
  await sql.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
