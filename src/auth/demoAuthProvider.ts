import { type AccessRole, isAccessRole } from '@/access/permissions';
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
 *   DEMO_AUTH_USERS="user@example.org|the-password|Display Name|Job title|ACCESS_ROLE; ..."
 *
 * ACCESS_ROLE is optional and is AUTHORIZED_USER unless it says ADMINISTRATOR.
 * A deployment with no administrator has nobody who can review a dataset
 * request, which /api/auth/status reports so it is visible rather than
 * discovered later.
 *
 * See .env.example. Nothing in this file is sent to the browser: it is only
 * imported by route handlers, which run on the server.
 */

interface DemoAccount {
  username: string;
  password: string;
  name: string;
  /** Job title, shown in the account menu. */
  title: string;
  /** What the account may do. */
  role: AccessRole;
}

/**
 * The account used when DEMO_AUTH_USERS is unset, so that a fresh checkout
 * runs with `npm run dev` and no setup. Refused outside development.
 */
const DEVELOPMENT_FALLBACK: DemoAccount = {
  username: 'demo@chigari.org',
  password: 'chigari-demo',
  name: 'Demo Officer',
  title: 'Field officer',
  role: 'ADMINISTRATOR',
};

let warnedAboutFallback = false;

/**
 * Drops one matching pair of wrapping quotes.
 *
 * `.env` files quote a value that contains spaces, but a hosting dashboard
 * takes the value literally, so the same line pasted into one from the other
 * arrives with the quotes still attached. Left alone that turns the first
 * username into `"someone@example.org` and the last field into `Role"`, and
 * sign-in then fails with nothing to suggest why. Tolerating it costs a line;
 * a password may legitimately begin and end with a quote, so only the whole
 * value and the individual fields are unwrapped, never anything in between.
 */
function unquote(value: string): string {
  const trimmed = value.trim();
  const first = trimmed[0];
  if ((first === '"' || first === "'") && trimmed.length > 1 && trimmed.endsWith(first)) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/**
 * Drops a `DEMO_AUTH_USERS=` prefix.
 *
 * The documented line is `NAME=value`, and a hosting dashboard asks for the
 * name and the value in separate boxes. Pasting the whole line into the value
 * box makes the first username `DEMO_AUTH_USERS=someone@example.org`, which
 * fails in a way that looks exactly like a wrong password.
 */
function stripAssignment(value: string): string {
  const match = /^\s*DEMO_AUTH_USERS\s*=\s*(.*)$/s.exec(value);
  return match ? match[1] : value;
}

function parseAccounts(): DemoAccount[] {
  const raw = unquote(stripAssignment(unquote(process.env.DEMO_AUTH_USERS ?? '')));

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
      const [username, password, name, title, role] = entry
        .split('|')
        .map((part) => unquote(part ?? ''));
      const declared = role.toUpperCase().replace(/[\s-]+/g, '_');
      return {
        username,
        password,
        name: name || username,
        title: title || 'User',
        role: isAccessRole(declared) && declared !== 'VISITOR' ? declared : 'AUTHORIZED_USER',
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

  countIdentities(): number {
    return parseAccounts().length;
  },

  countAdministrators(): number {
    return parseAccounts().filter((a) => a.role === 'ADMINISTRATOR').length;
  },

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
      user: {
        sub: account.username,
        name: account.name,
        title: account.title,
        role: account.role,
        status: 'VERIFIED',
        email: account.username,
      },
    };
  },
};
