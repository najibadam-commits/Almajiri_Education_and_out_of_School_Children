import type { AccessRole } from '@/access/permissions';
import type { AccountStatus } from '@/store/types';

/** The identity the application carries around once a session exists. */
export interface SessionUser {
  /** Stable subject id: a user id, or `visitor` for an anonymous session. */
  sub: string;
  /** Display name, shown in the header. */
  name: string;
  /** Job title or descriptive label, shown in the account menu. */
  title: string;
  /** What this session is allowed to do. Enforced server-side. */
  role: AccessRole;
  /** Whether the account has proved its email address. */
  status: AccountStatus;
  /** Present for an account; absent for a visitor. */
  email?: string;
}

export interface Credentials {
  username: string;
  password: string;
  remember: boolean;
}

export type SignInResult = { ok: true; user: SessionUser } | { ok: false; error: string };

/**
 * The contract a sign-in provider implements. Swapping the demo provider for a
 * real identity provider means implementing this and nothing else.
 */
export interface AuthProviderAdapter {
  /** A label for the provider, surfaced in logs and the login page notice. */
  readonly name: string;
  /** True when this provider must not be used to protect real data. */
  readonly isDemo: boolean;
  verifyCredentials(credentials: Credentials): Promise<SignInResult>;
  /**
   * How many sign-in identities this provider currently has, or null when the
   * provider cannot know. Deliberately a count and never the identities
   * themselves: it exists so a deployment can be told apart from its
   * configuration without disclosing either.
   */
  countIdentities?(): number | null;
  /** How many of those may administer the platform. */
  countAdministrators?(): number | null;
}
