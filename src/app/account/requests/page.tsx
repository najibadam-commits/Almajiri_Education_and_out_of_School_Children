import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { can } from '@/access/permissions';
import { getCurrentUser } from '@/auth/currentUser';
import { createDownloadToken } from '@/auth/downloadToken';
import { MyRequests, type RequestRow } from '@/components/account/MyRequests';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { store } from '@/store';
import '../../workspace.css';

export const metadata: Metadata = {
  title: 'My Data Requests · CHIGARI Almajiri Education Information System',
};

/** Nothing here may be cached: it is one person's own record. */
export const dynamic = 'force-dynamic';

export default async function AccountRequestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/account/requests');
  // Visitor mode is an access mode, not an account, so it has no requests to
  // show. The middleware turns visitors away already; this is the page
  // refusing for itself rather than trusting that it was redirected.
  if (user.role === 'VISITOR') redirect('/login?next=/account/requests');

  const verified = user.status === 'VERIFIED';
  // The same care as the administration page: if the records cannot be read,
  // say so on a page that renders rather than throwing at somebody who only
  // wanted to see their own requests.
  const health = await store.check();
  const [datasets, requests, record] = health.ok
    ? await Promise.all([
        store.listDatasets(),
        store.listRequestsForUser(user.sub),
        // Absent for a seeded administrator, whose session has no stored account.
        store.findUserById(user.sub),
      ])
    : [await store.listDatasets(), [], null];

  const names = new Map(datasets.map((dataset) => [dataset.id, dataset.name]));
  const now = Date.now();

  const rows: RequestRow[] = await Promise.all(
    requests.map(async (request) => {
      const live =
        request.status === 'APPROVED' &&
        request.expiresAt !== null &&
        new Date(request.expiresAt).getTime() > now;

      /*
       * The approval link is emailed, but it is also minted here so the owner
       * can collect the dataset from their own page. It is safe to render:
       * the download route re-checks the signature, the expiry, the session
       * identity and the request's current status before it sends anything,
       * so the link is worth nothing to anyone else.
       */
      const downloadHref = live
        ? `/api/downloads/${await createDownloadToken({
            requestId: request.id,
            userId: request.userId,
            datasetId: request.datasetId,
            format: request.requestedFormat,
            exp: Math.floor(new Date(request.expiresAt as string).getTime() / 1000),
          })}`
        : null;

      return {
        id: request.id,
        datasetName: names.get(request.datasetId) ?? request.datasetId,
        requestedFormat: request.requestedFormat,
        purpose: request.purpose,
        status: request.status,
        requestedAt: request.requestedAt,
        reviewedAt: request.reviewedAt,
        expiresAt: request.expiresAt,
        intendedUse: request.intendedUse,
        downloadHref,
      };
    }),
  );

  const requestable = datasets
    .filter((dataset) => dataset.accessLevel === 'RESTRICTED')
    .map(({ id, name, description, formats }) => ({ id, name, description, formats }));

  return (
    <div className="workspace">
      <WorkspaceHeader user={user} />
      <main className="ws-main">
        <h1 className="ws-title">Data access</h1>
        <p className="ws-subtitle">
          Signed in as {user.name}
          {user.email ? ` · ${user.email}` : ''}
        </p>
        {!health.ok && (
          <p className="ws-notice">
            <b>The records cannot be reached.</b> A database is configured for this deployment, but{' '}
            {health.detail}. Your requests cannot be listed and a new one cannot be submitted until
            that is fixed. Nothing you have already asked for has been lost.
          </p>
        )}

        <MyRequests
          datasets={requestable}
          requests={rows}
          organization={record?.organization ?? ''}
          canRequest={can(user.role, 'REQUEST_DATA_ACCESS', { verified })}
          verificationPending={!verified}
          unavailable={!health.ok}
        />
      </main>
    </div>
  );
}
