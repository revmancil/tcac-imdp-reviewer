// Supabase (Postgres) data access layer for the TCAC (Texas Council of Alpha
// Chapters) Intake Review Tool. Candidates are stored with a few promoted
// columns (for SQL filter/sort) plus a JSON `data` blob holding the nested
// docs/workflow/sponsor/etc. shape described in shared/types.ts.
// See migrations/0001_initial_schema.sql and migrations/0002_officer_credentials.sql.

import postgres from 'postgres';
import { SEED_CANDIDATES } from '../../shared/seed-candidates.js';
import { statusByKey, REQUIRED_DOCS } from '../../shared/reference.js';
import { computeSponsorRecommenderCheck } from '../../shared/word-count.js';
import type { Candidate } from '../../shared/types.js';

// Supabase's pooled connection (port 6543, pgbouncer in transaction mode)
// is the right choice for a serverless deployment — it doesn't support
// prepared statements across requests, hence `prepare: false`. If you
// instead point DATABASE_URL at the direct connection (port 5432) this
// still works fine.
const sql = postgres(process.env.DATABASE_URL || '', {
  prepare: false,
  ssl: 'require',
});

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS candidates (
  id              TEXT PRIMARY KEY,
  full_id         TEXT NOT NULL,
  name            TEXT NOT NULL,
  initials        TEXT NOT NULL,
  chapter_key     TEXT NOT NULL,
  chapter_type    TEXT NOT NULL,
  school          TEXT NOT NULL DEFAULT '',
  gpa             REAL NOT NULL DEFAULT 0,
  status_key      TEXT NOT NULL DEFAULT 'received',
  submitted       TEXT NOT NULL,
  last_activity   TEXT NOT NULL,
  is_new          INTEGER NOT NULL DEFAULT 0,
  data            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_candidates_chapter ON candidates(chapter_key);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status_key);
CREATE TABLE IF NOT EXISTS audit_log (
  id            SERIAL PRIMARY KEY,
  candidate_id  TEXT NOT NULL,
  officer_id    TEXT NOT NULL,
  action        TEXT NOT NULL,
  detail        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS officer_credentials (
  officer_id       TEXT PRIMARY KEY,
  email            TEXT UNIQUE NOT NULL,
  password_hash    TEXT NOT NULL,
  password_salt    TEXT NOT NULL,
  iterations       INTEGER NOT NULL DEFAULT 100000,
  failed_attempts  INTEGER NOT NULL DEFAULT 0,
  locked_until     TIMESTAMPTZ,
  must_change      INTEGER NOT NULL DEFAULT 1,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_officer_credentials_email ON officer_credentials(email);
`;

let schemaReady = false;
let seedChecked = false;

export async function ensureReady() {
  if (!schemaReady) {
    await sql.unsafe(SCHEMA_SQL);
    schemaReady = true;
  }
  if (!seedChecked) {
    seedChecked = true;
    const rows = await sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM candidates`;
    if (!rows[0] || rows[0].n === 0) {
      await seedDatabase();
    }
  }
}

async function seedDatabase() {
  await sql.begin((tx) => Promise.all(SEED_CANDIDATES.map((c) => upsertCandidateRow(c, tx))));
}

async function upsertCandidateRow(c: Candidate, db: postgres.Sql<any> | postgres.TransactionSql<any> = sql) {
  const rest: any = { ...c };
  // status/chapter/gpa/etc are promoted columns; keep the rest in `data`.
  await db`
    INSERT INTO candidates
      (id, full_id, name, initials, chapter_key, chapter_type, school, gpa, status_key, submitted, last_activity, is_new, data)
    VALUES
      (${c.id}, ${c.fullId}, ${c.name}, ${c.initials}, ${c.chapterKey}, ${c.chapterType}, ${c.school}, ${c.gpa}, ${c.status.key}, ${c.submitted}, ${c.lastActivity}, ${c.isNew ? 1 : 0}, ${JSON.stringify(rest)})
    ON CONFLICT (id) DO UPDATE SET
      full_id = EXCLUDED.full_id,
      name = EXCLUDED.name,
      initials = EXCLUDED.initials,
      chapter_key = EXCLUDED.chapter_key,
      chapter_type = EXCLUDED.chapter_type,
      school = EXCLUDED.school,
      gpa = EXCLUDED.gpa,
      status_key = EXCLUDED.status_key,
      submitted = EXCLUDED.submitted,
      last_activity = EXCLUDED.last_activity,
      is_new = EXCLUDED.is_new,
      data = EXCLUDED.data
  `;
}

// Backfills any document key that's been added to REQUIRED_DOCS since this
// row was last saved (e.g. enrollmentLetter) -- rows saved under an older
// schema won't have it in their stored `docs`, and the UI indexes docs by
// key assuming every required doc is present. Missing keys are added as
// "not received" rather than left absent so DocStateDot etc. never see
// undefined.
function withCompleteDocs(docs: Record<string, Candidate['docs'][string]> | undefined): Candidate['docs'] {
  const complete = { ...(docs || {}) };
  for (const d of REQUIRED_DOCS) {
    if (!complete[d.key]) complete[d.key] = { present: false, valid: false, note: null, file: null };
  }
  return complete;
}

function rowToCandidate(row: Record<string, any>): Candidate {
  const data = JSON.parse(row.data as string);
  return {
    ...data,
    id: row.id,
    fullId: row.full_id,
    name: row.name,
    initials: row.initials,
    chapterKey: row.chapter_key,
    chapterType: row.chapter_type,
    school: row.school,
    gpa: row.gpa,
    status: statusByKey(row.status_key),
    submitted: row.submitted,
    lastActivity: row.last_activity,
    isNew: !!row.is_new,
    docs: withCompleteDocs(data.docs),
    // Recomputed on every read rather than trusted from storage -- the
    // sponsor/recommender letters can change independently of when this
    // check was last saved (e.g. a letter gets extracted from a later
    // application upload), so a stored value would go stale.
    checks: {
      ...data.checks,
      sponsorRecommender: computeSponsorRecommenderCheck(data.sponsor ?? null, data.recommender ?? null),
    },
  };
}

export interface ListOptions {
  q?: string;
  status?: string;
  type?: string;
  chapterKey?: string;
  sort?: string;
  allowedChapterKeys?: string[] | 'all';
}

const SORT_MAP: Record<string, string> = {
  name: 'name ASC',
  school: 'school ASC',
  gpa: 'gpa DESC',
  submitted: 'submitted DESC',
  id: 'id ASC',
};

export async function listCandidates(opts: ListOptions): Promise<Candidate[]> {
  await ensureReady();

  if (opts.allowedChapterKeys && opts.allowedChapterKeys !== 'all' && opts.allowedChapterKeys.length === 0) {
    return [];
  }

  const allowed = opts.allowedChapterKeys && opts.allowedChapterKeys !== 'all' ? opts.allowedChapterKeys : null;
  const status = opts.status && opts.status !== 'all' ? opts.status : null;
  const type = opts.type && opts.type !== 'all' ? opts.type : null;
  const chapterKey = opts.chapterKey && opts.chapterKey !== 'all' ? opts.chapterKey : null;
  const like = opts.q ? `%${opts.q}%` : null;
  const orderBy = SORT_MAP[opts.sort || 'id'] || SORT_MAP.id;

  const rows = await sql`
    SELECT * FROM candidates
    WHERE (${allowed}::text[] IS NULL OR chapter_key = ANY(${allowed}::text[]))
      AND (${status}::text IS NULL OR status_key = ${status})
      AND (${type}::text IS NULL OR chapter_type = ${type})
      AND (${chapterKey}::text IS NULL OR chapter_key = ${chapterKey})
      AND (${like}::text IS NULL OR name ILIKE ${like} OR school ILIKE ${like} OR id ILIKE ${like} OR full_id ILIKE ${like})
    ORDER BY is_new DESC, ${sql.unsafe(orderBy)}
  `;
  return (rows as any[]).map(rowToCandidate);
}

export async function getCandidate(id: string): Promise<Candidate | null> {
  await ensureReady();
  const rows = await sql`SELECT * FROM candidates WHERE id = ${id}`;
  return rows.length ? rowToCandidate(rows[0]) : null;
}

export async function candidateExists(id: string): Promise<boolean> {
  await ensureReady();
  const rows = await sql`SELECT 1 AS x FROM candidates WHERE id = ${id}`;
  return rows.length > 0;
}

export async function insertCandidate(c: Candidate): Promise<void> {
  await ensureReady();
  await upsertCandidateRow(c);
}

export async function insertCandidates(list: Candidate[]): Promise<void> {
  await ensureReady();
  if (list.length === 0) return;
  await sql.begin((tx) => Promise.all(list.map((c) => upsertCandidateRow(c, tx))));
}

export async function updateCandidateDoc(
  id: string,
  docKey: string,
  doc: Candidate['docs'][string]
): Promise<Candidate | null> {
  await ensureReady();
  const existing = await getCandidate(id);
  if (!existing) return null;
  existing.docs = { ...existing.docs, [docKey]: doc };
  existing.lastActivity = new Date().toISOString().slice(0, 10);
  await upsertCandidateRow(existing);
  return existing;
}

// Merges arbitrary top-level fields (e.g. essayText, or a sponsor/recommender
// letter extracted from a freshly-uploaded application) into a candidate's
// record. Generic on purpose -- narrower than updateCandidateDoc's single-doc
// shape, since these updates don't correspond to a specific document key.
export async function updateCandidateFields(id: string, fields: Partial<Candidate>): Promise<Candidate | null> {
  await ensureReady();
  const existing = await getCandidate(id);
  if (!existing) return null;
  Object.assign(existing, fields);
  await upsertCandidateRow(existing);
  return existing;
}

export async function logAudit(candidateId: string, officerId: string, action: string, detail?: string) {
  await ensureReady();
  await sql`INSERT INTO audit_log (candidate_id, officer_id, action, detail) VALUES (${candidateId}, ${officerId}, ${action}, ${detail || null})`;
}

export async function missingReport(allowedChapterKeys: string[] | 'all') {
  return listCandidates({ allowedChapterKeys, sort: 'id' });
}

// ---------------------------------------------------------------------------
// Officer credentials (real password auth — see src/lib/password.ts)
// ---------------------------------------------------------------------------

export interface OfficerCredentialRow {
  officer_id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  iterations: number;
  failed_attempts: number;
  locked_until: string | Date | null;
  must_change: number;
  updated_at: string | Date;
}

export async function countCredentials(): Promise<number> {
  await ensureReady();
  const rows = await sql<{ n: number }[]>`SELECT COUNT(*)::int AS n FROM officer_credentials`;
  return rows[0]?.n || 0;
}

export async function getCredentialByOfficerId(officerId: string): Promise<OfficerCredentialRow | null> {
  await ensureReady();
  const rows = await sql`SELECT * FROM officer_credentials WHERE officer_id = ${officerId}`;
  return (rows[0] as OfficerCredentialRow) || null;
}

export async function getCredentialByEmail(email: string): Promise<OfficerCredentialRow | null> {
  await ensureReady();
  const rows = await sql`SELECT * FROM officer_credentials WHERE LOWER(email) = LOWER(${email.trim()})`;
  return (rows[0] as OfficerCredentialRow) || null;
}

export async function listCredentialsMeta(): Promise<Omit<OfficerCredentialRow, 'password_hash' | 'password_salt'>[]> {
  await ensureReady();
  const rows = await sql`
    SELECT officer_id, email, iterations, failed_attempts, locked_until, must_change, updated_at
    FROM officer_credentials
  `;
  return rows as any;
}

export async function upsertCredential(
  officerId: string,
  email: string,
  hash: string,
  salt: string,
  iterations: number,
  mustChange: boolean
): Promise<void> {
  await ensureReady();
  await sql`
    INSERT INTO officer_credentials (officer_id, email, password_hash, password_salt, iterations, failed_attempts, locked_until, must_change, updated_at)
    VALUES (${officerId}, ${email.trim()}, ${hash}, ${salt}, ${iterations}, 0, NULL, ${mustChange ? 1 : 0}, now())
    ON CONFLICT (officer_id) DO UPDATE SET
      email = EXCLUDED.email,
      password_hash = EXCLUDED.password_hash,
      password_salt = EXCLUDED.password_salt,
      iterations = EXCLUDED.iterations,
      failed_attempts = 0,
      locked_until = NULL,
      must_change = EXCLUDED.must_change,
      updated_at = now()
  `;
}

export async function recordFailedLogin(officerId: string, maxAttempts: number, lockoutMinutes: number): Promise<void> {
  await ensureReady();
  const row = await getCredentialByOfficerId(officerId);
  if (!row) return;
  const attempts = row.failed_attempts + 1;
  const lockUntil = attempts >= maxAttempts
    ? new Date(Date.now() + lockoutMinutes * 60_000).toISOString()
    : null;
  await sql`
    UPDATE officer_credentials
    SET failed_attempts = ${attempts}, locked_until = ${lockUntil}, updated_at = now()
    WHERE officer_id = ${officerId}
  `;
}

export async function resetFailedLogins(officerId: string): Promise<void> {
  await ensureReady();
  await sql`
    UPDATE officer_credentials
    SET failed_attempts = 0, locked_until = NULL, updated_at = now()
    WHERE officer_id = ${officerId}
  `;
}

export async function setPassword(officerId: string, hash: string, salt: string, iterations: number, mustChange: boolean): Promise<void> {
  await ensureReady();
  await sql`
    UPDATE officer_credentials
    SET password_hash = ${hash}, password_salt = ${salt}, iterations = ${iterations}, must_change = ${mustChange ? 1 : 0}, failed_attempts = 0, locked_until = NULL, updated_at = now()
    WHERE officer_id = ${officerId}
  `;
}
