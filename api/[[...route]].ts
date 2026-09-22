// Vercel serverless entry point. Every request under /api/* is routed here
// and handed to the Hono app in src/index.tsx. This runs on the Node.js
// runtime (not Edge) because the Postgres connection (src/lib/db.ts) needs a
// raw TCP socket, which Edge Functions don't support.
import { handle } from 'hono/vercel'
import app from '../src/index'

export const config = {
  runtime: 'nodejs',
}

export default handle(app)
