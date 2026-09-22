'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { PURPOSES } from '@/store/types';

/**
 * Account registration.
 *
 * Creating an account gives the platform identity and accountability. It does
 * not give anyone a dataset: that is a separate request that an administrator
 * reviews. The form says so rather than letting someone discover it later.
 */
interface Submitted {
  message: string;
  verificationLink: string | null;
  deliveryConfigured: boolean;
}

const FIELDS = [
  { name: 'fullName', label: 'Full Name', type: 'text', autoComplete: 'name', required: true },
  { name: 'email', label: 'Email Address', type: 'email', autoComplete: 'email', required: true },
  { name: 'organization', label: 'Organization / Institution', type: 'text', autoComplete: 'organization', required: true },
  { name: 'jobTitle', label: 'Job Title / Role', type: 'text', autoComplete: 'organization-title', required: true },
  { name: 'phone', label: 'Phone Number', type: 'tel', autoComplete: 'tel', required: false },
  { name: 'country', label: 'Country', type: 'text', autoComplete: 'country-name', required: true },
  { name: 'location', label: 'State / Location', type: 'text', autoComplete: 'address-level1', required: true },
] as const;

export function RegisterForm({ next }: { next: string }) {
  const [values, setValues] = useState<Record<string, string>>({
    fullName: '', email: '', organization: '', jobTitle: '', phone: '',
    country: 'Nigeria', location: '', purpose: '', password: '', confirmPassword: '',
  });
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<Submitted | null>(null);

  const set = (name: string, value: string) => setValues((v) => ({ ...v, [name]: value }));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/account/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...values, agreedToTerms: agreed }),
      });
      const body = (await response.json().catch(() => ({}))) as Partial<Submitted> & { error?: string };
      if (!response.ok) {
        setError(body.error ?? 'That could not be submitted. Please try again.');
        setSubmitting(false);
        return;
      }
      setDone({
        message: body.message ?? 'Your account has been created.',
        verificationLink: body.verificationLink ?? null,
        deliveryConfigured: body.deliveryConfigured ?? false,
      });
    } catch {
      setError('Could not reach the platform. Check your connection and try again.');
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <section className="login-card register-card" aria-labelledby="registered-title">
        <h1 id="registered-title">Check your email</h1>
        <p className="intro">{done.message}</p>

        {!done.deliveryConfigured && done.verificationLink && (
          <div className="demo-note verify-note">
            <b>NO MAIL SERVICE ON THIS DEPLOYMENT.</b> Nothing was actually emailed, so the
            verification link is here instead. Connect a mail provider and this stops appearing.
            <a className="verify-link" href={done.verificationLink}>
              Verify my email address
            </a>
          </div>
        )}

        <Link className="ghost-btn" href={next}>
          Continue browsing the platform
        </Link>
        <p className="secure-note">
          You can explore everything a visitor can see while your account is pending.
        </p>
      </section>
    );
  }

  return (
    <section className="login-card register-card" aria-labelledby="register-title">
      <h1 id="register-title">Create an account</h1>
      <p className="intro">
        An account lets you request controlled datasets. It does not grant downloads on its own —
        each request is reviewed by an administrator.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <fieldset>
          <legend>Personal information</legend>
          <div className="field-grid personal">
            {FIELDS.map((field) => (
              <div className="field" key={field.name}>
                <label htmlFor={field.name}>
                  {field.label}
                  {!field.required && <span className="optional"> (optional)</span>}
                </label>
                <div className="input-wrap">
                  <input
                    id={field.name}
                    name={field.name}
                    type={field.type}
                    autoComplete={field.autoComplete}
                    value={values[field.name]}
                    onChange={(e) => set(field.name, e.target.value)}
                    required={field.required}
                  />
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Purpose of access</legend>
          <div className="field">
            <label htmlFor="purpose">What do you need access for?</label>
            <div className="input-wrap">
              <select
                id="purpose"
                name="purpose"
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
        </fieldset>

        <fieldset>
          <legend>Account security</legend>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="input-wrap">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={values.password}
                  onChange={(e) => set('password', e.target.value)}
                  required
                  minLength={10}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <div className="input-wrap">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={values.confirmPassword}
                  onChange={(e) => set('confirmPassword', e.target.value)}
                  required
                  minLength={10}
                />
              </div>
            </div>
          </div>
          <p className="field-hint">At least 10 characters.</p>
        </fieldset>

        <div className="terms">
          <input
            id="terms"
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <label htmlFor="terms">
            I agree to the platform&apos;s Terms of Use and Data Access Policy
          </label>
        </div>

        <button className="primary-btn" type="submit" disabled={submitting}>
          {submitting ? 'Creating your account…' : 'Create Account'}
        </button>

        <div className={`message${error ? ' error' : ''}`} role="status" aria-live="polite">
          {error}
        </div>
      </form>

      <p className="demo-note">
        <b>CONCEPT PROTOTYPE.</b> The figures on this platform are sample data. Accounts here are
        for demonstrating the access workflow and are not a production identity service.
      </p>
    </section>
  );
}
