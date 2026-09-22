import { isAccessRole } from '@/access/permissions';
import type { SessionUser } from './types';

/**
 * Session encoding.
 *
 * The token is a compact HMAC-SHA256 signed payload, built with the Web Crypto
 * API so it can be verified in middleware on the Edge runtime as well as in
 * route handlers. This is deliberately small: it carries who the user is and
 * when the session expires, and nothing else.
 *
 * This is NOT a production identity system. It exists so that `/dashboard` can
 * be protected on the server today, and so the protection does not have to be
 * rewritten when a real identity provider is connected.
 */

export const SESSION_COOKIE = 'chigari_session';

/** Session lifetime when "remember me" is off: one browser session, 8 hours. */
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

/** Session lifetime when "remember me" is on: 30 days. */
export const REMEMBERED_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface SessionPayload extends SessionUser {
  /** Expiry, in seconds since the epoch. */
  exp: number;
}

/** The session a visitor gets: an access mode, not an account. */
export const VISITOR_SESSION: SessionUser = {
  sub: 'visitor',
  name: 'Visitor',
  title: 'Public access',
  role: 'VISITOR',
  status: 'VERIFIED',
};

/** Visitor sessions are short: it is a way in, not a login. */
export const VISITOR_TTL_SECONDS = 12 * 60 * 60;

/**
 * Brings a decoded payload up to the current shape.
 *
 * A cookie issued before roles existed carries a job title in `role` and no
 * `title` or `status` at all. Rather than log those people out, the old label
 * moves to `title` and the session is treated as an ordinary authorized user —
 * which is what it was. An unrecognised role is never trusted upwards.
 */
function normalise(payload: SessionPayload): SessionPayload {
  if (isAccessRole(payload.role) && payload.title && payload.status) return payload;
  const legacyTitle = typeof payload.role === 'string' ? payload.role : '';
  return {
    ...payload,
    title: payload.title || legacyTitle || 'User',
    role: isAccessRole(payload.role) ? payload.role : 'AUTHORIZED_USER',
    status: payload.status ?? 'VERIFIED',
  };
}

const encoder = new TextEncoder();

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

/**
 * The signing secret.
 *
 * In production this must be set. In development a fixed fallback keeps
 * `npm run dev` working out of the box, and says so once on the server console.
 */
let warnedAboutSecret = false;

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 16) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'SESSION_SECRET is not set, or is shorter than 16 characters. ' +
        'Set it before running a production build.',
    );
  }
  if (!warnedAboutSecret) {
    warnedAboutSecret = true;
    console.warn(
      '[auth] SESSION_SECRET is not set. Using an insecure development fallback. ' +
        'See .env.example.',
    );
  }
  return 'chigari-development-secret-do-not-use-in-production';
}

async function signingKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(sessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/** Builds a signed session token for `user`. */
export async function createSessionToken(user: SessionUser, ttlSeconds: number): Promise<string> {
  const payload: SessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', await signingKey(), encoder.encode(body));
  return `${body}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/**
 * Verifies a session token and returns its payload.
 *
 * Returns null for anything that is not a valid, unexpired, correctly signed
 * token, so callers can treat null as "not signed in" without inspecting why.
 */
export async function readSessionToken(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await signingKey(),
      base64UrlDecode(signature),
      encoder.encode(body),
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as SessionPayload;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) return null;
    return normalise(payload);
  } catch {
    return null;
  }
}

/** Cookie options shared by the login and logout routes. */
export function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}
