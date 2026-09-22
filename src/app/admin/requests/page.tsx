import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { can } from '@/access/permissions';
import { getCurrentUser } from '@/auth/currentUser';
import { ReviewQueue, type ReviewRow } from '@/components/admin/ReviewQueue';
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader';
import { notificationService } from '@/services/notificationService';
import { store } from '@/store';
import '../../workspace.css';

export const metadata: Metadata = {
  title: 'Data request review · CHIGARI Almajiri Education Information System',
};

export const dynamic = 'force-dynamic';

/**
 * The administration area.
 *
 * The page refuses for itself as well as being gated by the middleware: a
 * route that is only protected in one place is protected by whichever of them
 * nobody has changed yet.
 */
export default async function AdminRequestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin/requests');
  if (!can(user.role, 'REVIEW_DOWNLOAD_REQUESTS', { verified: user.status === 'VERIFIED' })) {
    redirect('/dashboard');
  }

  const [requests, users, datasets, outbox] = await Promise.all([
    store.listAllRequests(),
    store.listUsers(),
    store.listDatasets(),
    store.listMessages(),
  ]);

  const rows: ReviewRow[] = requests.map((request) => {
    const account = users.find((candidate) => candidate.id === request.userId);
    return {
      id: request.id,
      userName: account?.fullName || request.userName,
      userEmail: account?.email || request.userEmail,
      organization: account?.organization || request.organization,
      datasetName: datasets.find((d) => d.id === request.datasetId)?.name ?? request.datasetId,
      purpose: request.purpose,
      requestedFormat: request.requestedFormat,
      intendedUse: request.intendedUse,
      reason: request.reason,
      comments: request.comments,
      status: request.status,
      requestedAt: request.requestedAt,
      reviewedAt: request.reviewedAt,
      reviewedBy: request.reviewedBy,
      reviewerNotes: request.reviewerNotes,
      expiresAt: request.expiresAt,
    };
  });

  const pending = rows.filter((r) => r.status === 'PENDING' || r.status === 'UNDER_REVIEW').length;

  return (
    <div className="workspace">
      <WorkspaceHeader user={user} />
      <main className="ws-main wide">
        <h1 className="ws-title">Dataset access requests</h1>
        <p className="ws-subtitle">
          {pending === 0
            ? 'Nothing is waiting for a decision.'
            : `${pending} request${pending === 1 ? '' : 's'} waiting for a decision.`}{' '}
          {registeredLine(users.length)}
        </p>

        {!store.durable && (
          <p className="ws-notice">
            <b>Records are held in memory on this deployment.</b> Accounts, requests and approvals
            are lost when the server restarts, and a serverless host restarts often. Connect a
            database before this is used for anything real.
          </p>
        )}

        <ReviewQueue
          requests={rows}
          outbox={outbox}
          mailConfigured={notificationService.canDeliver}
        />
      </main>
    </div>
  );
}

function registeredLine(count: number): string {
  if (count === 0) return 'No accounts have been registered yet.';
  return `${count} registered account${count === 1 ? '' : 's'}.`;
}
