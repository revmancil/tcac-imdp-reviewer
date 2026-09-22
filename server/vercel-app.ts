// Source for the Vercel serverless function. This gets bundled by esbuild
// (see package.json "build:api") into a single self-contained file at
// api/[[...route]].js — Vercel's zero-config Node.js Function builder for
// this project was not tracing/including the local src/ and shared/ files
// that api/[[...route]].ts imported (deploys failed with
// ERR_MODULE_NOT_FOUND for '../src/index.js' at runtime), so we bundle
// everything ourselves instead of relying on that tracing. Runs on the
// Node.js runtime (not Edge) because the Postgres connection
// (src/lib/db.ts) needs a raw TCP socket, which Edge Functions don't
// support.
import { handle } from 'hono/vercel'
import app from '../src/index.js'

export const config = {
  runtime: 'nodejs',
}

export default handle(app)
