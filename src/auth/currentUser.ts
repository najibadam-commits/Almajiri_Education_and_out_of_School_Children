import { cookies } from 'next/headers';
import { type Permission, can } from '@/access/permissions';
import { SESSION_COOKIE, readSessionToken } from './session';
import type { SessionUser } from './types';

/**
 * Reads the session inside a server component.
 * Returns null when there is no valid session at all — not even a visitor one.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const session = await readSessionToken(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const { sub, name, title, role, status, email } = session;
  return { sub, name, title, role, status, email };
}

/** Whether the current session may do something. Server-side only. */
export async function currentUserCan(permission: Permission): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return can(user.role, permission, { verified: user.status === 'VERIFIED' });
}
