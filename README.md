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

- **Audit trail** table exists (`audit_log`) but there's no UI to view it yet.
- Reviewer notes / "Mark Complete" / "Request Docs" buttons are visual only (not wired to persistence) — same as the original design prototype.
- CSV export and "Send Reminders" on the Missing Items report are visual only.
- The "Modern Brotherhood" visual variant and the Tweaks panel from the design were intentionally **not** shipped (per the handoff README: Classic Collegiate is the shipping variant; the tweaks panel is a design-time affordance to strip).

## Auth & access control

Real password auth, self-contained in this stack (D1 + Web Crypto) — no
third-party identity provider required:

- **Password storage**: PBKDF2-SHA256, 100k iterations, random 16-byte salt per officer (`src/lib/password.ts`). No plaintext or reversibly-encrypted passwords anywhere.
- **Brute-force protection**: 5 failed attempts locks the account for 15 minutes (`MAX_LOGIN_ATTEMPTS` / `LOCKOUT_MINUTES` in `src/lib/auth.ts`); a locked account is rejected even with the correct password until the lock expires.
- **First login / admin reset**: officers don't self-register. A district-tier officer (District Director / Chief Dean of Membership Intake / Chief Administrator) opens **Officer Access** (`/admin`, linked from the user menu) and clicks "Reset Password" / "Issue Password" for any officer — this generates a random 12-character temp password shown once on screen. The admin relays it to the officer out of band (phone/text/in person); there's no email service wired up to send it automatically. The officer is forced into a "Set a New Password" modal on next sign-in and can't dismiss it or use the app until they set their own password (min 10 characters).
- **Session**: unchanged from before — signed HMAC-SHA256 httpOnly cookie (`src/lib/session.ts`), 14-day expiry. Only the credential-verification step upstream of it changed.
- **First-time production setup**: since officers start with no credentials at all, there's a one-time `POST /api/auth/bootstrap {secret}` endpoint that seeds a temp password for every officer that doesn't have one yet. It requires the `AUTH_BOOTSTRAP_SECRET` Worker secret (set via `gsk hosted secret_put --name AUTH_BOOTSTRAP_SECRET --value "$(openssl rand -hex 24)"` — **not** set by default in this deployment) and refuses to run once every officer already has a credential row (use the admin reset screen instead after that point). After bootstrapping, relay each returned temp password to its officer, then consider rotating/removing the `AUTH_BOOTSTRAP_SECRET` since it's no longer needed.
- **Login emails**: server-only, in `src/lib/auth.ts` (`OFFICER_EMAILS`) — never bundled into the client. Keyed by officer id (not derived from surname), so officers sharing a surname get distinct logins.
- **Officer roster (real names + emails, 20 accounts total)**: `shared/reference.ts` (`OFFICERS`) now lists the actual District/Area leadership instead of generic "Bro. Area Director" placeholders — 3 district-tier officers (Escalante, Bernard, Carroll) plus every Area 1–11 Director/Chief Dean/Assistant named by the district, each with the real personal email supplied. One intentional exception: **William Bernard** holds both the district-wide "Chief Dean of Membership Intake" seat and the Area 2 Director/Chief Dean seat under a **single** login (`scope: 'all'` already covers Area 2) — there is no separate `bernard-4042` account, unlike the `tanner-4041`/`carroll-4041` split which uses two distinct emails for two distinct people who happen to share a surname. Area 7's Area Director seat is filled by Trent Bishop, who also serves as Chief Dean (one account, one title covering both).

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
- **Officer credentials**: no officer has a password yet on a fresh deploy. Bootstrap once via `AUTH_BOOTSTRAP_SECRET` — see "Auth & access control" above — then relay each temp password to its officer out of band.
- **Roster updates after officers already have credentials**: if `shared/reference.ts`/`OFFICER_EMAILS` change (e.g. adding/renaming an officer) after `/api/auth/bootstrap` has already run once, bootstrap will only seed the *new* officer ids it doesn't recognize yet — it won't touch existing rows. A removed/renamed officer id's old credential row is orphaned (harmless, just unreachable) rather than deleted; use the district-tier **Officer Access** admin screen to issue a fresh password for any officer whose email changed.

To redeploy after future code changes: `npm run build` locally to confirm it compiles, commit, then run `gsk hosted deploy` and approve the resulting pending action in the sandbox UI. If a redeploy ever needs a secret re-set (rare — bindings usually persist), re-run `gsk hosted secret_put --name SESSION_SECRET --value "$(openssl rand -hex 32)"` (and/or the `AUTH_BOOTSTRAP_SECRET` equivalent).

### Known gaps for real production use
- Officer sign-in is now real password auth (hashed+salted, lockout, forced first-change — see "Auth & access control"), but there's no SSO/email-authentication provider integration and no automated email delivery for temp passwords — resets are relayed by a district-tier officer out of band. The "Sign in with Alpha Member Portal" button on `/signin` is still a disabled placeholder.
- No rate limiting beyond per-account lockout / audit-log UI yet (the `audit_log` D1 table is populated on writes but not surfaced in the app).
