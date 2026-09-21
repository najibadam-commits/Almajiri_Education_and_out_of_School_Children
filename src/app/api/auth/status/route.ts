import { NextResponse } from 'next/server';
import { authService } from '@/auth/authService';

/**
 * What this deployment is running, and whether it has anything to sign in
 * with. Nothing here is a secret: a count, some booleans and the commit the
 * build came from.
 *
 * It exists because "Those credentials were not recognised" cannot tell you
 * whether the deployment never received your accounts, received them mangled,
 * or received them fine and you mistyped the password — and on a hosted build
 * there is otherwise no way to find out without reading server logs. It
 * deliberately does not disclose usernames, so it cannot be used to discover
 * who can sign in.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  const identities = authService.identityCount;

  return NextResponse.json(
    {
      provider: authService.providerName,
      demo: authService.isDemo,
      /** How many accounts the deployment parsed. Never which. */
      accountsConfigured: identities,
      /** Set, or the build would have refused to sign anyone in. */
      sessionSecretSet: (process.env.SESSION_SECRET?.length ?? 0) >= 16,
      /** Which commit is live, so a redeploy can be told from a stale one. */
      build: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
      hint:
        identities === 0
          ? 'DEMO_AUTH_USERS is empty or missing on this deployment. Set it, then redeploy — a new variable does not reach a build that already happened.'
          : 'Accounts are configured. If sign-in is still refused, the username or password does not match what this deployment was given.',
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
