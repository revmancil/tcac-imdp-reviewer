// Source for the Vercel serverless function. This gets bundled by esbuild
// (see package.json "build:api") into a single self-contained file at
// api/handler.js -- Vercel's zero-config Node.js Function builder for this
// project was not tracing/including the local src/ and shared/ files this
// used to import directly (deploys failed with ERR_MODULE_NOT_FOUND), so we
// bundle everything ourselves instead of relying on that tracing. The file
// is named plainly (not a [[...route]] catch-all) because Vercel's generic
// (non-Next.js) Functions routing didn't reliably match that catch-all
// syntax past one path segment; vercel.json instead rewrites every /api/*
// request here directly, which preserves the original path for Hono's own
// routing. Runs on the Node.js runtime (not Edge) because the Postgres
// connection (src/lib/db.ts) needs a raw TCP socket, which Edge Functions
// don't support.
import { handle } from 'hono/vercel'
import app from '../src/index.js'

export const config = {
  runtime: 'nodejs',
  // Default function timeout (10s on Hobby, 15s on Pro) is too short for a
  // cold-start OCR request on /api/candidates/parse-application -- it needs
  // to download tesseract.js's language model on first use, then render and
  // OCR two PDF pages. 60s is the maximum allowed on the Hobby plan; raise
  // it further if the account is on Pro/Enterprise and cold starts still run
  // long.
  maxDuration: 60,
}

// Vercel's Node.js Functions runtime expects a Web-standard handler as a
// named `fetch` export (or per-method exports like `GET`/`POST`) -- a
// `default` export that returns a Response is silently ignored (its return
// value is dropped, per Vercel's function-signature warning).
export const fetch = handle(app)
