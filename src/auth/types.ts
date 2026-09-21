/** The identity the application carries around once a user is signed in. */
export interface SessionUser {
  /** Stable subject id. */
  sub: string;
  /** Display name, shown in the header. */
  name: string;
  /** Role label. Not yet used for authorisation. */
  role: string;
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
}
