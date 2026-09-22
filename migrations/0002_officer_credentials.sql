-- Officer login credentials for real password-based authentication.
-- Kept entirely separate from `shared/reference.ts` OFFICERS (which is
-- bundled into the client too) — nothing secret ever leaves this table.
-- Seeded once via POST /api/auth/bootstrap (self-disables after first use);
-- see README "Auth & access control" for the bootstrap + admin-reset flow.
--
-- Postgres/Supabase dialect (see src/lib/db.ts, which also creates this
-- schema lazily on first request — this file is for explicit `npm run
-- db:migrate` runs and for review).

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
