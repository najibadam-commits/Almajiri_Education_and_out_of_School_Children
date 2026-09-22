/**
 * Password hashing.
 *
 * PBKDF2 over the Web Crypto API, so it runs wherever the rest of the auth
 * code does and adds no dependency. A password is never stored, never logged
 * and never returned from a route.
 *
 * This is a reasonable floor, not the last word: a real deployment should use
 * a memory-hard function such as Argon2id or scrypt. Both the hash and the
 * salt live on the user record, so re-hashing on next sign-in is the upgrade
 * path when that day comes.
 */

const ITERATIONS = 210_000;
const KEY_LENGTH = 32;
const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function derive(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    KEY_LENGTH * 8,
  );
  return toHex(new Uint8Array(bits));
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { hash: await derive(password, salt), salt: toHex(salt) };
}

/** Compares in time that does not depend on where the two first differ. */
export async function verifyPassword(
  password: string,
  hash: string,
  salt: string,
): Promise<boolean> {
  if (!hash || !salt) return false;
  let candidate: string;
  try {
    candidate = await derive(password, fromHex(salt));
  } catch {
    return false;
  }
  if (candidate.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

/** A URL-safe random token, for email verification and download links. */
export function randomToken(bytes = 24): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
}
