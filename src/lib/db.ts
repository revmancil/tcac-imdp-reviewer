// D1 data access layer for the TCAC (Texas Council of Alpha Chapters) Intake Review Tool.
// Candidates are stored with a few promoted columns (for SQL filter/sort)
// plus a JSON `data` blob holding the nested docs/workflow/sponsor/etc.
// shape described in shared/types.ts. See migrations/0001_initial_schema.sql.

import { SEED_CANDIDATES } from '../../shared/seed-candidates';
import { statusByKey } from '../../shared/reference';
import type { Candidate } from '../../shared/types';

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
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_candidates_chapter ON candidates(chapter_key);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status_key);
CREATE TABLE IF NOT EXISTS audit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  candidate_id  TEXT NOT NULL,
  officer_id    TEXT NOT NULL,
  action        TEXT NOT NULL,
  detail        TEXT,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

let schemaReady = false;
let seedChecked = false;

export async function ensureReady(db: D1Database) {
  if (!schemaReady) {
    await db.batch(
      SCHEMA_SQL.split(';').map((s) => s.trim()).filter(Boolean).map((s) => db.prepare(s))
    );
    schemaReady = true;
  }
  if (!seedChecked) {
    seedChecked = true;
    const row = await db.prepare('SELECT COUNT(*) AS n FROM candidates').first<{ n: number }>();
    if (!row || row.n === 0) {
      await seedDatabase(db);
    }
  }
}

async function seedDatabase(db: D1Database) {
  const stmts = SEED_CANDIDATES.map((c) => insertStatement(db, c));
  await db.batch(stmts);
}

function insertStatement(db: D1Database, c: Candidate) {
  const rest: any = { ...c };
  // status/chapter/gpa/etc are promoted columns; keep the rest in `data`.
  return db
    .prepare(
      `INSERT OR REPLACE INTO candidates
        (id, full_id, name, initials, chapter_key, chapter_type, school, gpa, status_key, submitted, last_activity, is_new, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      c.id,
      c.fullId,
      c.name,
      c.initials,
      c.chapterKey,
      c.chapterType,
      c.school,
      c.gpa,
      c.status.key,
      c.submitted,
      c.lastActivity,
      c.isNew ? 1 : 0,
      JSON.stringify(rest)
    );
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

export async function listCandidates(db: D1Database, opts: ListOptions): Promise<Candidate[]> {
  await ensureReady(db);
  const clauses: string[] = [];
  const binds: any[] = [];

  if (opts.allowedChapterKeys && opts.allowedChapterKeys !== 'all') {
    if (opts.allowedChapterKeys.length === 0) return [];
    clauses.push(`chapter_key IN (${opts.allowedChapterKeys.map(() => '?').join(',')})`);
    binds.push(...opts.allowedChapterKeys);
  }
  if (opts.status && opts.status !== 'all') {
    clauses.push('status_key = ?');
    binds.push(opts.status);
  }
  if (opts.type && opts.type !== 'all') {
    clauses.push('chapter_type = ?');
    binds.push(opts.type);
  }
  if (opts.chapterKey && opts.chapterKey !== 'all') {
    clauses.push('chapter_key = ?');
    binds.push(opts.chapterKey);
  }
  if (opts.q) {
    clauses.push('(LOWER(name) LIKE ? OR LOWER(school) LIKE ? OR LOWER(id) LIKE ? OR LOWER(full_id) LIKE ?)');
    const like = `%${opts.q.toLowerCase()}%`;
    binds.push(like, like, like, like);
  }

  let sql = 'SELECT * FROM candidates';
  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');

  const sortMap: Record<string, string> = {
    name: 'name ASC',
    school: 'school ASC',
    gpa: 'gpa DESC',
    submitted: 'submitted DESC',
    id: 'id ASC',
  };
  sql += ' ORDER BY is_new DESC, ' + (sortMap[opts.sort || 'id'] || sortMap.id);

  const { results } = await db.prepare(sql).bind(...binds).all();
  return (results || []).map(rowToCandidate);
}

export async function getCandidate(db: D1Database, id: string): Promise<Candidate | null> {
  await ensureReady(db);
  const row = await db.prepare('SELECT * FROM candidates WHERE id = ?').bind(id).first();
  return row ? rowToCandidate(row) : null;
}

export async function candidateExists(db: D1Database, id: string): Promise<boolean> {
  await ensureReady(db);
  const row = await db.prepare('SELECT 1 AS x FROM candidates WHERE id = ?').bind(id).first();
  return !!row;
}

export async function insertCandidate(db: D1Database, c: Candidate): Promise<void> {
  await ensureReady(db);
  await insertStatement(db, c).run();
}

export async function insertCandidates(db: D1Database, list: Candidate[]): Promise<void> {
  await ensureReady(db);
  if (list.length === 0) return;
  await db.batch(list.map((c) => insertStatement(db, c)));
}

export async function updateCandidateDoc(
  db: D1Database,
  id: string,
  docKey: string,
  doc: Candidate['docs'][string]
): Promise<Candidate | null> {
  await ensureReady(db);
  const existing = await getCandidate(db, id);
  if (!existing) return null;
  existing.docs = { ...existing.docs, [docKey]: doc };
  existing.lastActivity = new Date().toISOString().slice(0, 10);
  await insertStatement(db, existing).run();
  return existing;
}

export async function logAudit(db: D1Database, candidateId: string, officerId: string, action: string, detail?: string) {
  await ensureReady(db);
  await db
    .prepare('INSERT INTO audit_log (candidate_id, officer_id, action, detail) VALUES (?, ?, ?, ?)')
    .bind(candidateId, officerId, action, detail || null)
    .run();
}

export async function missingReport(db: D1Database, allowedChapterKeys: string[] | 'all') {
  const list = await listCandidates(db, { allowedChapterKeys, sort: 'id' });
  return list;
}
