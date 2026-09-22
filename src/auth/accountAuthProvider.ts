import { store } from '@/store';
import { verifyPassword } from './passwords';
import type { AuthProviderAdapter, Credentials, SignInResult } from './types';

/**
 * Sign-in for accounts people registered themselves.
 *
 * Passwords are compared against a PBKDF2 hash held on the user record; the
 * password itself is never stored. An account that has not verified its email
 * may still sign in — the brief asks that a pending user can keep browsing —
 * but it carries PENDING_VERIFICATION, and `can()` holds a session in that
 * state at visitor permissions until the address is proved.
 */
export const accountAuthProvider: AuthProviderAdapter = {
  name: 'Platform accounts',
  isDemo: false,

  async verifyCredentials({ username, password }: Credentials): Promise<SignInResult> {
    const user = await store.findUserByEmail(username);
    if (!user) return { ok: false, error: 'Those credentials were not recognised.' };

    if (user.accountStatus === 'SUSPENDED') {
      return { ok: false, error: 'This account has been suspended. Contact the platform team.' };
    }

    const matches = await verifyPassword(password, user.passwordHash, user.passwordSalt);
    if (!matches) return { ok: false, error: 'Those credentials were not recognised.' };

    return {
      ok: true,
      user: {
        sub: user.id,
        name: user.fullName,
        title: user.jobTitle || user.organization,
        role: user.role,
        status: user.accountStatus,
        email: user.email,
      },
    };
  },
};
