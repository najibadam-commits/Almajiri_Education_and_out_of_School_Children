'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * The two ways in.
 *
 * "Continue as Visitor" asks the server for a visitor session and goes
 * straight to the dashboard: no email, no password, no account created. The
 * session it gets back carries the VISITOR role, and every protected route
 * checks that role for itself.
 */
export function AccessCards({ next }: { next: string }) {
  const router = useRouter();
  const [entering, setEntering] = useState(false);
  const [error, setError] = useState('');

  async function continueAsVisitor() {
    if (entering) return;
    setEntering(true);
    setError('');
    try {
      const response = await fetch('/api/access/visitor', { method: 'POST' });
      if (!response.ok) throw new Error('visitor session refused');
      router.replace(next);
      router.refresh();
    } catch {
      setError('Could not open the platform just now. Check your connection and try again.');
      setEntering(false);
    }
  }

  const signInHref = `/login/sign-in?next=${encodeURIComponent(next)}`;
  const registerHref = `/register?next=${encodeURIComponent(next)}`;

  return (
    <div className="access-cards">
      <section className="access-card" aria-labelledby="visitor-title">
        <span className="access-kicker">Option 1</span>
        <h2 id="visitor-title">Continue as Visitor</h2>
        <p>Explore the platform and view available education data without creating an account.</p>
        <button className="primary-btn" onClick={continueAsVisitor} disabled={entering}>
          {entering ? 'Opening the platform…' : 'Continue as Visitor'}
        </button>
        <p className="access-note">No registration required · View-only access</p>
        {error && (
          <p className="access-error" role="status">
            {error}
          </p>
        )}
      </section>

      <section className="access-card" aria-labelledby="authorized-title">
        <span className="access-kicker">Option 2</span>
        <h2 id="authorized-title">Authorized User</h2>
        <p>
          Sign in or create an account to access controlled resources and request downloadable
          datasets.
        </p>
        <Link className="primary-btn" href={signInHref}>
          Sign In
        </Link>
        <Link className="ghost-btn" href={registerHref}>
          Create Account
        </Link>
        <p className="access-note">Downloads are granted by request and review</p>
      </section>
    </div>
  );
}
