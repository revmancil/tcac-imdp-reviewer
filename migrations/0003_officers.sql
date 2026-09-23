-- Officer directory, moved off the hardcoded `OFFICERS` object in
-- shared/reference.ts so district-tier admins can add/remove officers
-- from the app itself instead of needing a code change + redeploy.
--
-- `scope` stores the same shape OfficerPublic always used ('"all"' or a
-- JSON array like '[4041]'), just JSON-encoded into a column. `active`
-- is a soft-delete flag -- "remove" deactivates rather than hard-deletes,
-- so audit_log/officer_credentials rows referencing an officer_id never
-- go orphaned and a removal can be undone.
--
-- Postgres/Supabase dialect (see src/lib/db.ts, which also creates this
-- schema lazily on first request, and seeds it from the previously-
-- hardcoded OFFICERS/OFFICER_EMAILS the first time the table is empty --
-- this file is for explicit `npm run db:migrate` runs and for review).

CREATE TABLE IF NOT EXISTS officers (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  title       TEXT NOT NULL,
  initials    TEXT NOT NULL,
  area        INTEGER,
  tier        TEXT NOT NULL,
  scope       TEXT NOT NULL,
  email       TEXT NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_officers_active ON officers(active);
