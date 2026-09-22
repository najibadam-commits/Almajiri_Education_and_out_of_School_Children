import { randomToken } from './passwords';

/**
 * Links to an approved dataset.
 *
 * A download link is not a path to a file. It is a signed statement that a
 * named request, belonging to a named user, was approved and has not expired
 * — and the route that serves it re-checks every one of those facts against
 * the store before it sends a byte. So a leaked link is useless to anyone not
 * signed in as its owner, and a revoked approval stops working immediately.
 *
 * Signed with the session secret over the Web Crypto API, the same way the
 * session cookie is.
 */
const encoder = new TextEncoder();

export interface DownloadClaim {
  requestId: string;
  userId: string;
  datasetId: string;
  format: string;
  /** Expiry, in seconds since the epoch. */
  exp: number;
  /** Makes two links for the same approval different from each other. */
  nonce: string;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 16) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is not set, or is shorter than 16 characters.');
  }
  return 'chigari-development-secret-do-not-use-in-production';
}

async function key(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(`download:${secret()}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function createDownloadToken(
  claim: Omit<DownloadClaim, 'nonce'>,
): Promise<string> {
  const payload: DownloadClaim = { ...claim, nonce: randomToken(6) };
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', await key(), encoder.encode(body));
  return `${body}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/** Returns the claim, or null for anything invalid, tampered with or expired. */
export async function readDownloadToken(token: string | undefined): Promise<DownloadClaim | null> {
  if (!token) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await key(),
      base64UrlDecode(signature),
      encoder.encode(body),
    );
    if (!valid) return null;
    const claim = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as DownloadClaim;
    if (typeof claim.exp !== 'number' || claim.exp * 1000 <= Date.now()) return null;
    return claim;
  } catch {
    return null;
  }
}

/** How long an approved download stays usable. */
export const DOWNLOAD_TTL_SECONDS = 14 * 24 * 60 * 60;
