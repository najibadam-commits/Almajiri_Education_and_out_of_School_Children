import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  createSessionToken,
  readSessionToken,
  sessionCookieOptions,
} from '@/auth/session';
import { store } from '@/store';

/**
 * Confirms an email address.
 *
 * A POST rather than a GET on the link itself: mail clients and link scanners
 * fetch every URL in a message, and a token that is spent by being fetched is
 * a token the recipient never gets to use. The page behind the link asks for a
 * click, and this is what that click calls.
 *
 * The token is consumed on first use. If the person is signed in as the
 * account being verified, their session cookie is reissued here too — the
 * cookie carries the account status, so without this they would stay held at
 * visitor permissions until the next sign-in.
 */
export async function POST(request: Request) {
  let token = '';
  try {
    const body = (await request.json()) as { token?: unknown };
    token = typeof body.token === 'string' ? body.token.trim() : '';
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }

  if (!token) {
    return NextResponse.json({ error: 'That link is missing its token.' }, { status: 400 });
  }

  const user = await store.findUserByVerificationToken(token);
  if (!user) {
    return NextResponse.json(
      {
        error:
          'That verification link is not valid. It may already have been used, or the account may no longer exist.',
      },
      { status: 400 },
    );
  }

  const verified =
    (await store.updateUser(user.id, {
      accountStatus: 'VERIFIED',
      verificationToken: null,
    })) ?? user;

  const response = NextResponse.json({
    ok: true,
    name: verified.fullName,
    message: 'Your email address is confirmed. Your account is now active.',
  });

  const jar = await cookies();
  const session = await readSessionToken(jar.get(SESSION_COOKIE)?.value);
  if (session?.sub === verified.id) {
    // Reissued for what was left of the old session, not for a fresh full
    // term: confirming an address should not quietly extend how long someone
    // stays signed in for.
    const remaining = Math.max(60, session.exp - Math.floor(Date.now() / 1000));
    const refreshed = await createSessionToken(
      {
        sub: verified.id,
        name: verified.fullName,
        title: verified.jobTitle || verified.organization,
        role: verified.role,
        status: 'VERIFIED',
        email: verified.email,
      },
      remaining,
    );
    response.cookies.set(SESSION_COOKIE, refreshed, sessionCookieOptions(remaining));
  }

  return response;
}
