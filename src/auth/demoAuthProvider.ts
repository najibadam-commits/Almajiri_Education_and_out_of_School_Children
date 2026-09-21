import type { AuthProviderAdapter, Credentials, SignInResult } from './types';

/**
 * ============================================================================
 * DEMO AUTH — NOT PRODUCTION AUTH
 * ============================================================================
 *
 * This provider exists so the concept prototype has a working front door. It
 * checks a username and password against a small list configured in the
 * environment. It does no rate limiting, no lockout, no password hashing and
 * no account recovery, and it is not a substitute for an identity provider.
 *
 * Accounts are read from DEMO_AUTH_USERS rather than written into source, in
 * the format:
 *
 *   DEMO_AUTH_USERS="user@example.org|the-password|Display Name|Role; ..."
 *
 * See .env.example. Nothing in this file is sent to the browser: it is only
 * imported by route handlers, which run on the server.
 */

interface DemoAccount {
  username: string;
  password: string;
  name: string;
  role: string;
}

/**
 * The account used when DEMO_AUTH_USERS is unset, so that a fresh checkout
 * runs with `npm run dev` and no setup. Refused outside development.
 */
const DEVELOPMENT_FALLBACK: DemoAccount = {
  username: 'demo@chigari.org',
  password: 'chigari-demo',
  name: 'Demo Officer',
  role: 'Field officer',
};

let warnedAboutFallback = false;

function parseAccounts(): DemoAccount[] {
  const raw = process.env.DEMO_AUTH_USERS?.trim();

  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      // Refusing here is deliberate: a production deployment that silently
      // accepted a published default password would be worse than one that
      // cannot sign anyone in.
      return [];
    }
    if (!warnedAboutFallback) {
      warnedAboutFallback = true;
      console.warn(
        `[auth] DEMO_AUTH_USERS is not set. Using the development account ` +
          `"${DEVELOPMENT_FALLBACK.username}". See .env.example.`,
      );
    }
    return [DEVELOPMENT_FALLBACK];
  }

  return raw
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [username, password, name, role] = entry.split('|').map((part) => part?.trim() ?? '');
      return {
        username,
        password,
        name: name || username,
        role: role || 'User',
      };
    })
    .filter((account) => account.username && account.password);
}

/**
 * Compares two strings in time that does not depend on where they first
 * differ. Not a substitute for hashing, but it costs nothing here.
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const demoAuthProvider: AuthProviderAdapter = {
  name: 'Demo accounts',
  isDemo: true,

  async verifyCredentials({ username, password }: Credentials): Promise<SignInResult> {
    const accounts = parseAccounts();

    if (accounts.length === 0) {
      return {
        ok: false,
        error: 'No sign-in accounts are configured. Connect an identity provider to continue.',
      };
    }

    const candidate = username.trim().toLowerCase();
    const account = accounts.find((a) => a.username.toLowerCase() === candidate);

    // Compared even when no account matched, so that a wrong username and a
    // wrong password take the same path and return the same message.
    const passwordMatches = constantTimeEquals(password, account?.password ?? '\u0000');

    if (!account || !passwordMatches) {
      return { ok: false, error: 'Those credentials were not recognised.' };
    }

    return {
      ok: true,
      user: { sub: account.username, name: account.name, role: account.role },
    };
  },
};
