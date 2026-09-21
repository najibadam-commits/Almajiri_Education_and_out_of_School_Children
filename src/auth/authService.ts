import { demoAuthProvider } from './demoAuthProvider';
import type { AuthProviderAdapter, Credentials, SignInResult } from './types';

/**
 * The application's authentication entry point.
 *
 * The rest of the app calls `authService` and never a provider directly, so
 * connecting a real identity provider is a change to `activeProvider` and an
 * adapter that implements `AuthProviderAdapter` — not a change to the
 * dashboard, the middleware or the login page.
 */
const activeProvider: AuthProviderAdapter = demoAuthProvider;

export const authService = {
  /** True while sign-in is backed by the demo provider. */
  get isDemo(): boolean {
    return activeProvider.isDemo;
  },

  /** The active provider's label. */
  get providerName(): string {
    return activeProvider.name;
  },

  signIn(credentials: Credentials): Promise<SignInResult> {
    return activeProvider.verifyCredentials(credentials);
  },
};
