import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { type Permission, can } from '@/access/permissions';
import { SESSION_COOKIE, readSessionToken } from './session';
import type { SessionUser } from './types';

/**
 * Permission checks for route handlers.
 *
 * Hiding a control in the interface is a courtesy; this is the enforcement.
 * Every route that does something a visitor may not do begins by calling
 * `requirePermission`, so a hand-written request gets the same answer as a
 * click on a button that was never rendered.
 */
export type Guarded<T> = { ok: true; user: SessionUser } | { ok: false; response: NextResponse<T> };

export async function sessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const session = await readSessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const { sub, name, title, role, status, email } = session;
  return { sub, name, title, role, status, email };
}

export async function requirePermission(permission: Permission): Promise<Guarded<{ error: string; reason: string }>> {
  const user = await sessionUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Sign in to continue.', reason: 'NO_SESSION' },
        { status: 401 },
      ),
    };
  }

  if (can(user.role, permission, { verified: user.status === 'VERIFIED' })) {
    return { ok: true, user };
  }

  // The interface uses the reason to decide what to offer: a visitor is shown
  // the way to an account, a pending user the way to verify.
  const reason =
    user.role === 'VISITOR'
      ? 'ACCOUNT_REQUIRED'
      : user.status !== 'VERIFIED'
        ? 'VERIFICATION_REQUIRED'
        : 'FORBIDDEN';

  const error =
    reason === 'ACCOUNT_REQUIRED'
      ? 'Downloading datasets requires an authorized account.'
      : reason === 'VERIFICATION_REQUIRED'
        ? 'Verify your email address to continue.'
        : 'Your account does not have access to this.';

  return { ok: false, response: NextResponse.json({ error, reason }, { status: 403 }) };
}
