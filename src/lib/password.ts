// Password hashing for officer credentials, built entirely on Web Crypto
// (portable across runtimes, no native bcrypt/argon2/scrypt binding needed).
// PBKDF2-SHA256 with a random per-user salt and a high iteration count.

const ITERATIONS = 100_000;
const HASH_BITS = 256;

function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return toHex(arr);
}

// Unambiguous charset (no 0/O, 1/l/I) — meant to be read aloud / typed once.
const TEMP_PASSWORD_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

export function randomTempPassword(length = 12): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => TEMP_PASSWORD_CHARS[b % TEMP_PASSWORD_CHARS.length]).join('');
}

async function pbkdf2(password: string, saltHex: string, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromHex(saltHex) as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    HASH_BITS
  );
  return toHex(bits);
}

export interface PasswordHashResult {
  hash: string;
  salt: string;
  iterations: number;
}

export async function hashPassword(password: string): Promise<PasswordHashResult> {
  const salt = randomHex(16);
  const hash = await pbkdf2(password, salt, ITERATIONS);
  return { hash, salt, iterations: ITERATIONS };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  storedSalt: string,
  iterations = ITERATIONS
): Promise<boolean> {
  const candidate = await pbkdf2(password, storedSalt, iterations);
  return timingSafeEqual(candidate, storedHash);
}
