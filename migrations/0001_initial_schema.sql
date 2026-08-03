-- Texas District Intake Review Tool — initial schema.
-- Candidate documents/workflow/sponsor/recommender/checks are stored as a
-- JSON blob in `data` (see shared/types.ts Candidate interface) while the
-- columns used for roster filtering/sorting are promoted for SQL querying.

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
