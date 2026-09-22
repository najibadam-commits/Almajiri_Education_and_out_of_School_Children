'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { PURPOSES } from '@/store/types';

/**
 * My Data Requests: the request form and the record of what was asked for.
 *
 * Submitting a request grants nothing. It records who asked, for what, and
 * why, and an administrator decides. The screen says so rather than letting
 * someone infer it from a request that never turns into a download.
 */
export interface RequestableDataset {
  id: string;
  name: string;
  description: string;
  formats: readonly string[];
}

export interface RequestRow {
  id: string;
  datasetName: string;
  requestedFormat: string;
  purpose: string;
  status: string;
  requestedAt: string;
  reviewedAt: string | null;
  expiresAt: string | null;
  intendedUse: string;
  /** Present only on an approved, unexpired request belonging to this user. */
  downloadHref: string | null;
}

const STATUS_COPY: Record<string, { label: string; note: string }> = {
  PENDING: {
    label: 'Pending',
    note: 'Submitted and waiting for an administrator to pick it up.',
  },
  UNDER_REVIEW: {
    label: 'Under Review',
    note: 'An administrator is looking at this request.',
  },
  APPROVED: {
    label: 'Approved',
    note: 'The dataset is ready to collect using the secure link below.',
  },
  REJECTED: {
    label: 'Rejected',
    note: 'This request was not approved. You may submit a new one with more detail.',
  },
  EXPIRED: {
    label: 'Expired',
    note: 'The approval window has closed. Submit a new request if you still need the data.',
  },
};

function when(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

interface MyRequestsProps {
  datasets: readonly RequestableDataset[];
  requests: readonly RequestRow[];
  organization: string;
  canRequest: boolean;
  /** Shown instead of the form when the account has not confirmed its address. */
  verificationPending: boolean;
}

export function MyRequests({
  datasets,
  requests,
  organization,
  canRequest,
  verificationPending,
}: MyRequestsProps) {
  const router = useRouter();
  const [values, setValues] = useState({
    datasetId: datasets[0]?.id ?? '',
    requestedFormat: datasets[0]?.formats[0] ?? 'CSV',
    purpose: '',
    organization,
    intendedUse: '',
    reason: '',
    comments: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const chosen = datasets.find((d) => d.id === values.datasetId);
  const set = (name: string, value: string) => setValues((v) => ({ ...v, [name]: value }));

  function chooseDataset(id: string) {
    const dataset = datasets.find((d) => d.id === id);
    setValues((v) => ({
      ...v,
      datasetId: id,
      requestedFormat: dataset?.formats.includes(v.requestedFormat)
        ? v.requestedFormat
        : (dataset?.formats[0] ?? 'CSV'),
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    setConfirmation('');

    try {
      const response = await fetch('/api/data-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!response.ok) {
        setError(body.error ?? 'That request could not be submitted.');
        setSubmitting(false);
        return;
      }
      setConfirmation(body.message ?? 'Your request has been submitted.');
      setValues((v) => ({ ...v, intendedUse: '', reason: '', comments: '' }));
      setSubmitting(false);
      router.refresh();
    } catch {
      setError('Could not reach the platform. Check your connection and try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="ws-columns">
      <section className="ws-panel" aria-labelledby="request-title">
        <h2 id="request-title">Request a dataset</h2>
        <p className="ws-lead">
          Datasets are released by request. Tell us what you need and what for, and an
          administrator will review it. Approval is not automatic.
        </p>

        {verificationPending ? (
          <p className="ws-notice">
            Confirm your email address to submit a request. The confirmation link was issued when
            you registered.
          </p>
        ) : !canRequest ? (
          <p className="ws-notice">
            Requesting datasets needs an authorized account.{' '}
            <Link href="/register">Create one here.</Link>
          </p>
        ) : (
          <form onSubmit={submit} noValidate>
            <div className="ws-field">
              <label htmlFor="datasetId">Dataset</label>
              <select
                id="datasetId"
                value={values.datasetId}
                onChange={(e) => chooseDataset(e.target.value)}
                required
              >
                {datasets.map((dataset) => (
                  <option key={dataset.id} value={dataset.id}>
                    {dataset.name}
                  </option>
                ))}
              </select>
              {chosen && <p className="ws-hint">{chosen.description}</p>}
            </div>

            <div className="ws-field-row">
              <div className="ws-field">
                <label htmlFor="requestedFormat">Format</label>
                <select
                  id="requestedFormat"
                  value={values.requestedFormat}
                  onChange={(e) => set('requestedFormat', e.target.value)}
                >
                  {(chosen?.formats ?? ['CSV']).map((format) => (
                    <option key={format} value={format}>
                      {format}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ws-field">
                <label htmlFor="purpose">Purpose</label>
                <select
                  id="purpose"
                  value={values.purpose}
                  onChange={(e) => set('purpose', e.target.value)}
                  required
                >
                  <option value="">Choose one…</option>
                  {PURPOSES.map((purpose) => (
                    <option key={purpose} value={purpose}>
                      {purpose}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="ws-field">
              <label htmlFor="organization">Organization making the request</label>
              <input
                id="organization"
                value={values.organization}
                onChange={(e) => set('organization', e.target.value)}
                required
              />
            </div>

            <div className="ws-field">
              <label htmlFor="intendedUse">How will the data be used?</label>
              <textarea
                id="intendedUse"
                rows={3}
                value={values.intendedUse}
                onChange={(e) => set('intendedUse', e.target.value)}
                required
              />
            </div>

            <div className="ws-field">
              <label htmlFor="reason">Why do you need this dataset?</label>
              <textarea
                id="reason"
                rows={3}
                value={values.reason}
                onChange={(e) => set('reason', e.target.value)}
                required
              />
            </div>

            <div className="ws-field">
              <label htmlFor="comments">
                Anything else the reviewer should know <span className="optional">(optional)</span>
              </label>
              <textarea
                id="comments"
                rows={2}
                value={values.comments}
                onChange={(e) => set('comments', e.target.value)}
              />
            </div>

            <button className="ws-primary" type="submit" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>

            {(error || confirmation) && (
              <p className={`ws-message${error ? ' error' : ' success'}`} role="status">
                {error || confirmation}
              </p>
            )}
          </form>
        )}
      </section>

      <section className="ws-panel" aria-labelledby="my-requests-title">
        <h2 id="my-requests-title">My Data Requests</h2>
        {requests.length === 0 ? (
          <p className="ws-empty">
            You have not requested a dataset yet. Anything you ask for will be listed here with its
            status.
          </p>
        ) : (
          <ul className="ws-list">
            {requests.map((request) => {
              const copy = STATUS_COPY[request.status] ?? { label: request.status, note: '' };
              return (
                <li key={request.id} className="ws-item">
                  <div className="ws-item-head">
                    <b>{request.datasetName}</b>
                    <span className={`status-pill ${request.status.toLowerCase()}`}>
                      {copy.label}
                    </span>
                  </div>
                  <dl className="ws-facts">
                    <div>
                      <dt>Requested</dt>
                      <dd>{when(request.requestedAt)}</dd>
                    </div>
                    <div>
                      <dt>Format</dt>
                      <dd>{request.requestedFormat}</dd>
                    </div>
                    <div>
                      <dt>Reviewed</dt>
                      <dd>{when(request.reviewedAt)}</dd>
                    </div>
                    <div>
                      <dt>Access until</dt>
                      <dd>{when(request.expiresAt)}</dd>
                    </div>
                  </dl>
                  <p className="ws-hint">{copy.note}</p>
                  {request.downloadHref && (
                    <a className="ws-primary download" href={request.downloadHref}>
                      Download {request.requestedFormat}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="ws-sample">
          <b>SAMPLE DATA ONLY.</b> Every dataset on this platform is generated for the concept
          prototype and is not Chigari Foundation operational data.
        </p>
      </section>
    </div>
  );
}
