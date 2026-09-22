import { NextResponse } from 'next/server';
import { authService } from '@/auth/authService';
import { notificationService } from '@/services/notificationService';
import { store } from '@/store';

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

export async function GET() {
  const identities = authService.identityCount;
  const administrators = authService.administratorCount;
  // Asked rather than assumed: a database that is configured but unreachable
  // must not be reported as one that is keeping records.
  const storage = await store.check();

  return NextResponse.json(
    {
      provider: authService.providerName,
      demo: authService.isDemo,
      /** How many accounts the deployment parsed. Never which. */
      accountsConfigured: identities,
      /** Set, or the build would have refused to sign anyone in. */
      sessionSecretSet: (process.env.SESSION_SECRET?.length ?? 0) >= 16,
      /** How many of those may review dataset requests. */
      administratorsConfigured: administrators,
      /** Where accounts, requests and approvals are held, and whether they survive. */
      storage: store.description,
      storageReachable: storage.ok,
      /** Durable only if it is also actually reachable. */
      storageDurable: store.durable && storage.ok,
      storageProblem: storage.ok ? null : storage.detail,
      /** Whether verification and approval messages actually leave the building. */
      mailConfigured: notificationService.canDeliver,
      /** Which commit is live, so a redeploy can be told from a stale one. */
      build: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local',
      hint: !storage.ok
        ? `DATABASE_URL is set but ${storage.detail}. Accounts, requests and approvals cannot be saved until that is fixed.`
        : identities === 0
          ? 'DEMO_AUTH_USERS is empty or missing on this deployment. Set it, then redeploy — a new variable does not reach a build that already happened.'
          : administrators === 0
            ? 'Accounts are configured, but none of them is an ADMINISTRATOR, so nobody can review a dataset request. Add ADMINISTRATOR as the fifth field of one account in DEMO_AUTH_USERS.'
            : 'Accounts are configured. If sign-in is still refused, the username or password does not match what this deployment was given.',
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
