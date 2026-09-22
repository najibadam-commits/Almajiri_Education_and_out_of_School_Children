import { accountAuthProvider } from './accountAuthProvider';
import { demoAuthProvider } from './demoAuthProvider';
import type { AuthProviderAdapter, Credentials, SignInResult } from './types';

/**
 * The application's authentication entry point.
 *
 * The rest of the app calls `authService` and never a provider directly, so
 * connecting a real identity provider is a change to this list and an adapter
 * that implements `AuthProviderAdapter` — not a change to the dashboard, the
 * middleware or the login page.
 *
 * Registered accounts are tried first and the environment's demo accounts
 * second, so a deployment can seed an administrator without a database while
 * people register normally alongside.
 */
const providers: readonly AuthProviderAdapter[] = [accountAuthProvider, demoAuthProvider];

/** The provider that decides what the login page says about itself. */
const seedProvider = demoAuthProvider;

export const authService = {
  /** True while the only configured identities are demo ones. */
  get isDemo(): boolean {
    return seedProvider.isDemo;
  },

  /** The active providers' labels. */
  get providerName(): string {
    return providers.map((p) => p.name).join(' + ');
  },

  /**
   * How many seed identities the deployment has. A count only — never the
   * identities — so it is safe to report from an unauthenticated route.
   */
  get identityCount(): number | null {
    return seedProvider.countIdentities?.() ?? null;
  },

  /** How many of those may review dataset requests. */
  get administratorCount(): number | null {
    return seedProvider.countAdministrators?.() ?? null;
  },

  async signIn(credentials: Credentials): Promise<SignInResult> {
    let lastError = 'Those credentials were not recognised.';
    for (const provider of providers) {
      const result = await provider.verifyCredentials(credentials);
      if (result.ok) return result;
      // A provider that knows the account and refuses it — a suspension —
      // has more to say than one that simply never heard of it.
      if (result.error !== lastError) lastError = result.error;
    }
    return { ok: false, error: lastError };
  },
};
