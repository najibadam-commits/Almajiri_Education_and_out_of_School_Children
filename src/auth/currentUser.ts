import { cookies } from 'next/headers';
import { SESSION_COOKIE, readSessionToken } from './session';
import type { SessionUser } from './types';

/**
 * Reads the signed-in user inside a server component.
 * Returns null when there is no valid session.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const session = await readSessionToken(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const { sub, name, role } = session;
  return { sub, name, role };
}
