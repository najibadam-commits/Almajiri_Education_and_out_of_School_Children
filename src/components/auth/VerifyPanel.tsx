'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * The confirm-your-address step.
 *
 * The link in the message lands on a page, not on the route that spends the
 * token, so a mail client that fetches every URL in a message cannot burn
 * somebody's verification for them. The button below is what spends it.
 */
export function VerifyPanel({ token }: { token: string }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'working' | 'done'>('idle');
  const [error, setError] = useState('');
  const [name, setName] = useState('');

  async function confirm() {
    if (state === 'working') return;
    setState('working');
    setError('');
    try {
      const response = await fetch('/api/account/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string; name?: string };
      if (!response.ok) {
        setError(body.error ?? 'That could not be confirmed. Please try again.');
        setState('idle');
        return;
      }
      setName(body.name ?? '');
      setState('done');
      // The session cookie may have been reissued with the new status, so the
      // server components rendered from it need re-running.
      router.refresh();
    } catch {
      setError('Could not reach the platform. Check your connection and try again.');
      setState('idle');
    }
  }

  if (!token) {
    return (
      <section className="login-card" aria-labelledby="verify-title">
        <h1 id="verify-title">Confirm your email address</h1>
        <p className="intro">
          This page needs the link from your verification message. Open that link, or register
          again to have a new one issued.
        </p>
        <Link className="ghost-btn" href="/register">
          Create an account
        </Link>
      </section>
    );
  }

  if (state === 'done') {
    return (
      <section className="login-card" aria-labelledby="verify-title">
        <h1 id="verify-title">Your account is active</h1>
        <p className="intro">
          {name ? `Thank you, ${name}. ` : ''}Your email address is confirmed. You can now request
          controlled datasets, and an administrator will review each request.
        </p>
        <Link className="primary-btn" href="/account/requests">
          Go to my data requests
        </Link>
        <Link className="ghost-btn" href="/dashboard">
          Open the dashboard
        </Link>
      </section>
    );
  }

  return (
    <section className="login-card" aria-labelledby="verify-title">
      <h1 id="verify-title">Confirm your email address</h1>
      <p className="intro">
        One click finishes your registration. Until it is confirmed, your account can see
        everything a visitor can and nothing more.
      </p>
      <button className="primary-btn" onClick={confirm} disabled={state === 'working'}>
        {state === 'working' ? 'Confirming…' : 'Confirm my email address'}
      </button>
      <div className={`message${error ? ' error' : ''}`} role="status" aria-live="polite">
        {error}
      </div>
      <p className="secure-note">
        This link works once. If it has already been used, sign in as usual.
      </p>
    </section>
  );
}
