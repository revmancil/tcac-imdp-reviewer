// Minimal signed-cookie session helper.
//
// NOTE (see README "Implementation Notes"): this is a demo-level session
// suitable for the design handoff. Real deployment must replace sign-in
// with the district's SSO / email-authentication provider and should move
// to a proper session store; this only proves the *shape* of server-side
// auth (httpOnly signed cookie, verified on every request) that a real
// integration would slot into.

import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { Context } from 'hono';

const COOKIE_NAME = 'apa_session';

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function setSession(c: Context, secret: string, officerId: string) {
  const sig = await hmac(secret, officerId);
  setCookie(c, COOKIE_NAME, `${officerId}.${sig}`, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function readSession(c: Context, secret: string): Promise<string | null> {
  const raw = getCookie(c, COOKIE_NAME);
  if (!raw) return null;
  const dot = raw.lastIndexOf('.');
  if (dot < 0) return null;
  const officerId = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = await hmac(secret, officerId);
  if (expected !== sig) return null;
  return officerId;
}

export function clearSession(c: Context) {
  deleteCookie(c, COOKIE_NAME, { path: '/' });
}
