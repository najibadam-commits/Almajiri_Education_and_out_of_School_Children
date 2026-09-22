'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * The administrator's review queue.
 *
 * Every decision here goes through the API, which checks the reviewer's
 * permission again before it changes anything. A reviewer who lost the role
 * between loading this page and pressing a button is refused by the server,
 * not by the page.
 */
export interface ReviewRow {
  id: string;
  userName: string;
  userEmail: string;
  organization: string;
  datasetName: string;
  purpose: string;
  requestedFormat: string;
  intendedUse: string;
  reason: string;
  comments: string;
  status: string;
  requestedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewerNotes: string | null;
  expiresAt: string | null;
}

export interface OutboxRow {
  id: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
}

const FILTERS = ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED', 'ALL'] as const;

const LABELS: Record<string, string> = {
  PENDING: 'Pending',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
  ALL: 'All',
};

function when(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ReviewQueue({
  requests,
  outbox,
  mailConfigured,
}: {
  requests: readonly ReviewRow[];
  outbox: readonly OutboxRow[];
  mailConfigured: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('PENDING');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const shown = requests.filter((r) => filter === 'ALL' || r.status === filter);
  const counts = Object.fromEntries(
    FILTERS.map((f) => [f, f === 'ALL' ? requests.length : requests.filter((r) => r.status === f).length]),
  ) as Record<string, number>;

  async function decide(id: string, decision: 'APPROVE' | 'REJECT' | 'REQUEST_INFO') {
    if (busy) return;
    setBusy(`${id}:${decision}`);
    setError('');
    try {
      const response = await fetch(`/api/data-requests/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, reviewerNotes: notes[id] ?? '' }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? 'That decision could not be recorded.');
        setBusy('');
        return;
      }
      setNotes((n) => ({ ...n, [id]: '' }));
      setBusy('');
      router.refresh();
    } catch {
      setError('Could not reach the platform. Check your connection and try again.');
      setBusy('');
    }
  }

  return (
    <>
      <div className="ws-filters" role="tablist" aria-label="Filter requests by status">
        {FILTERS.map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={filter === value}
            className={filter === value ? 'on' : undefined}
            onClick={() => setFilter(value)}
          >
            {LABELS[value]} <span>{counts[value]}</span>
          </button>
        ))}
      </div>

      {error && (
        <p className="ws-message error" role="status">
          {error}
        </p>
      )}

      {shown.length === 0 ? (
        <p className="ws-empty">Nothing to review with this filter.</p>
      ) : (
        <ul className="ws-list review">
          {shown.map((request) => {
            const open = request.status === 'PENDING' || request.status === 'UNDER_REVIEW';
            return (
              <li key={request.id} className="ws-item">
                <div className="ws-item-head">
                  <b>{request.datasetName}</b>
                  <span className={`status-pill ${request.status.toLowerCase()}`}>
                    {LABELS[request.status] ?? request.status}
                  </span>
                </div>

                <dl className="ws-facts">
                  <div>
                    <dt>Requester</dt>
                    <dd>{request.userName}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{request.userEmail || '—'}</dd>
                  </div>
                  <div>
                    <dt>Organization</dt>
                    <dd>{request.organization || '—'}</dd>
                  </div>
                  <div>
                    <dt>Purpose</dt>
                    <dd>{request.purpose}</dd>
                  </div>
                  <div>
                    <dt>Format</dt>
                    <dd>{request.requestedFormat}</dd>
                  </div>
                  <div>
                    <dt>Requested</dt>
                    <dd>{when(request.requestedAt)}</dd>
                  </div>
                </dl>

                <p className="ws-quote">
                  <b>Intended use.</b> {request.intendedUse}
                </p>
                <p className="ws-quote">
                  <b>Reason.</b> {request.reason}
                </p>
                {request.comments && (
                  <p className="ws-quote">
                    <b>Comments.</b> {request.comments}
                  </p>
                )}

                {request.reviewedAt && (
                  <p className="ws-hint">
                    Reviewed by {request.reviewedBy ?? 'an administrator'} on{' '}
                    {when(request.reviewedAt)}
                    {request.reviewerNotes ? ` · ${request.reviewerNotes}` : ''}
                    {request.expiresAt ? ` · access until ${when(request.expiresAt)}` : ''}
                  </p>
                )}

                {open && (
                  <div className="ws-decision">
                    <label htmlFor={`notes-${request.id}`}>
                      Reviewer notes <span className="optional">(required to reject)</span>
                    </label>
                    <textarea
                      id={`notes-${request.id}`}
                      rows={2}
                      value={notes[request.id] ?? ''}
                      onChange={(e) => setNotes((n) => ({ ...n, [request.id]: e.target.value }))}
                    />
                    <div className="ws-actions">
                      <button
                        className="ws-primary"
                        onClick={() => decide(request.id, 'APPROVE')}
                        disabled={busy !== ''}
                      >
                        {busy === `${request.id}:APPROVE` ? 'Approving…' : 'Approve'}
                      </button>
                      <button
                        className="ws-ghost"
                        onClick={() => decide(request.id, 'REQUEST_INFO')}
                        disabled={busy !== ''}
                      >
                        Request more information
                      </button>
                      <button
                        className="ws-danger"
                        onClick={() => decide(request.id, 'REJECT')}
                        disabled={busy !== ''}
                      >
                        {busy === `${request.id}:REJECT` ? 'Rejecting…' : 'Reject'}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <section className="ws-panel outbox" aria-labelledby="outbox-title">
        <h2 id="outbox-title">Notification outbox</h2>
        {mailConfigured ? (
          <p className="ws-lead">Every message the platform has sent, most recent first.</p>
        ) : (
          <p className="ws-notice">
            No mail provider is connected to this deployment, so nothing was actually emailed.
            Messages are recorded here instead, including the approval links, so the workflow can
            be completed and nothing is silently dropped.
          </p>
        )}
        {outbox.length === 0 ? (
          <p className="ws-empty">No messages yet.</p>
        ) : (
          <ul className="ws-list">
            {outbox.map((message) => (
              <li key={message.id} className="ws-item">
                <div className="ws-item-head">
                  <b>{message.subject}</b>
                  <span className="ws-hint">{when(message.sentAt)}</span>
                </div>
                <p className="ws-hint">To {message.to}</p>
                <pre className="ws-body">{message.body}</pre>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
