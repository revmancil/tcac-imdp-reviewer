# TCAC Intake Membership Review Tool

Alpha Phi Alpha Fraternity, Inc. — Southwestern Region · Texas Council of
Alpha Chapters (TCAC). An internal workflow app for TCAC officers to review
candidate membership applications for the current intake cycle. Built from a
Genspark Design handoff (`designer2-4dcc78be-8f9a-4836-8b4c-6ec1aa3b8e54`,
folder `design_handoff_intake_review/`), recreated as a production-shaped
Hono + Cloudflare Pages app (D1 + R2) instead of the original static HTML
prototype.

## Stack

- **Backend**: Hono on Cloudflare Pages Functions (`src/index.tsx`), Cloudflare **D1** (candidate records), Cloudflare **R2** (uploaded documents), signed httpOnly cookie session.
- **Frontend**: React 18 + react-router-dom, built as a separate Vite client bundle (`client/`) served as a static asset and mounted by the Worker's SPA fallback. Styling ported ~1:1 from the handoff's `styles.css` (Classic Collegiate variant — Playfair Display / Cormorant Garamond, gold/cream/black palette).
- **Shared reference data** (`shared/`): chapters, officers, workflow steps, required-doc list, status enum — used by both the API and the client.

## Completed features

- **Sign-in** (`/signin`) — email match against the officer directory (`lastname@apa-texas.org`) or one-click officer cards (demo shortcut), sets a signed session cookie.
- **Roster** (`/roster`) — stat cards, search, status/type/chapter filters, sort, scope banner for Area Directors, links to Missing Items + Add Candidate.
- **Candidate Detail** (`/candidates/:id`) — header, Sponsor/Recommender cards with "Preview letter" modal (parsed letter text) and "Open in App" (jumps to Application doc tab), Application Workflow timeline, Automated Review strip, 3-column split (document tab rail / PDF or mock document viewer / checklist + notes + activity), drag-and-drop upload and "Replace file" flow wired to a real `POST /api/candidates/:id/docs/:docKey` endpoint that stores the file in R2 and updates D1.
- **Missing Items Report** (`/missing`) — grouped by document type, scoped to the officer, links back into each candidate.
- **Add Candidate** (`/add`) — Manual entry form (validated client + server) and CSV bulk import (server-side parse/validate/preview/commit) with a downloadable CSV template.
- **Access control** — enforced **server-side** in every API route (`officerCanSeeChapterKey`) using the officer's area scope, not just filtered client-side; deep-linking to an out-of-scope candidate renders the "Access Restricted" screen from the design.
- Candidate #2897040 (Nazhir Carter, Rho Nu Lambda) ships with the 8 real reference PDFs from the handoff (served from `/static/pdfs/2897040/`) plus the parsed sponsor/recommender letters.

## API surface

- `POST /api/auth/signin` `{email}` · `POST /api/auth/quick-signin` `{officerId}` · `POST /api/auth/signout` · `GET /api/auth/me`
- `GET /api/reference` — chapters, officers, district, statuses, workflow steps, required docs
- `GET /api/candidates?q=&status=&type=&chapter=&sort=` (scoped to signed-in officer)
- `GET /api/candidates/:id` (403 `access_denied` with chapter/area info if out of scope)
- `POST /api/candidates` (manual add) · `POST /api/candidates/csv/preview` · `POST /api/candidates/csv/commit` · `GET /api/candidates/csv-template`
- `GET /api/candidates/missing-report`
- `POST /api/candidates/:id/docs/:docKey` (multipart `file`) → stores in R2, updates D1
- `GET /api/files/*` — streams an R2-stored upload

## Data model

D1 table `candidates`: promoted columns for filtering/sorting (`chapter_key`,
`chapter_type`, `status_key`, `gpa`, `submitted`, …) plus a `data` JSON blob
holding the nested `docs` / `workflow` / `sponsor` / `recommender` / `checks`
shape (see `shared/types.ts`). `audit_log` records every upload/replace/create
with officer id + timestamp. The DB is **lazily seeded** on first request from
`shared/seed-candidates.ts` (the 16 candidates from the design's `data.jsx`) —
no manual migration/seed step needed for local dev; `migrations/0001_initial_schema.sql`
is also provided for the standard `wrangler d1 migrations` workflow.

Reference data (chapters/officers/statuses/workflow steps/required docs) is
static TS in `shared/reference.ts` — matches the handoff's `CHAPTERS`/`OFFICERS`.

## Known gaps / next steps (see handoff README "Implementation Notes")

- **Auth is demo-level**: sign-in matches `lastname@apa-texas.org` (no password check) and the officer-card quick sign-in is a design-time affordance. Production must replace this with TCAC's real SSO / email-authentication provider — the signed-cookie session plumbing (`src/lib/session.ts`) is there to slot a real identity provider behind.
- **Audit trail** table exists (`audit_log`) but there's no UI to view it yet.
- Reviewer notes / "Mark Complete" / "Request Docs" buttons are visual only (not wired to persistence) — same as the original design prototype.
- CSV export and "Send Reminders" on the Missing Items report are visual only.
- The "Modern Brotherhood" visual variant and the Tweaks panel from the design were intentionally **not** shipped (per the handoff README: Classic Collegiate is the shipping variant; the tweaks panel is a design-time affordance to strip).

## Local development

```bash
npm run build        # builds client (public/static/app.js) then the Worker (dist/_worker.js)
pm2 start ecosystem.config.cjs   # wrangler pages dev dist --local (D1 + R2 emulated locally)
curl http://localhost:3000
```

## Deployment

**Status: ✅ Live** — deployed to Cloudflare Workers for Platform via Genspark Hosted Deploy.

- **Production URL**: https://748be431-d2a8-4adb-aa1c-712c30df8a2a.vip.gensparksite.com
- **Worker**: `748be431-d2a8-4adb-aa1c-712c30df8a2a`
- **D1 database**: `748be431-d2a8-4adb-aa1c-712c30df8a2a-db` (managed; migrations applied automatically from `migrations/`)
- **R2 bucket**: `748be431-d2a8-4adb-aa1c-712c30df8a2a-r2` (managed; stores uploaded candidate documents)
- **`SESSION_SECRET`**: set as an encrypted Worker secret via `gsk hosted secret_put` (not checked into `wrangler.jsonc`/git — the checked-in code only has a dev-only fallback for local `pm2`/`wrangler pages dev`).

To redeploy after future code changes: `npm run build` locally to confirm it compiles, commit, then run `gsk hosted deploy` and approve the resulting pending action in the sandbox UI. If a redeploy ever needs the secret re-set (rare — bindings usually persist), re-run `gsk hosted secret_put --name SESSION_SECRET --value "$(openssl rand -hex 32)"`.

### Known gaps for real production use
- Officer "sign-in" is a **demo shortcut** (email match against a hardcoded directory, or one-click officer cards) — no real password/SSO. Before handing this to real TCAC officers, wire `/api/auth/signin` to the district's actual SSO/email-authentication provider and remove the quick-signin officer-card list from `/signin`.
- No rate limiting / audit-log UI yet (the `audit_log` D1 table is populated on writes but not surfaced in the app).
