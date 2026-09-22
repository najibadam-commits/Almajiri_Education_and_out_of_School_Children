import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  VISITOR_SESSION,
  VISITOR_TTL_SECONDS,
  createSessionToken,
  sessionCookieOptions,
} from '@/auth/session';

/**
 * Enters visitor mode.
 *
 * This is an access mode, not a shared account: no email, no password, no
 * record created. It mints a signed session that says VISITOR, and the
 * permission table gives that role one thing — reading public data. Every
 * protected route checks the role in the cookie, so nothing about this is a
 * matter of what the interface chose to render.
 */
export async function POST() {
  const token = await createSessionToken(VISITOR_SESSION, VISITOR_TTL_SECONDS);
  const response = NextResponse.json({ user: VISITOR_SESSION });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(VISITOR_TTL_SECONDS));
  return response;
}
