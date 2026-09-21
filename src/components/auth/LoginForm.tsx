'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

interface LoginFormProps {
  /** Where to go after a successful sign-in. Always a same-origin path. */
  next: string;
  /** True while sign-in is backed by the demo provider. */
  isDemo: boolean;
}

type MessageTone = 'neutral' | 'error' | 'success';

/**
 * The CHIGARI sign-in card.
 *
 * The prototype navigated to the dashboard HTML file directly. Here the form
 * posts to the auth route, which sets the session cookie, and then routes
 * within the application.
 */
export function LoginForm({ next, isDemo }: LoginFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: MessageTone }>({
    text: '',
    tone: 'neutral',
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    if (!username.trim()) {
      setMessage({ text: 'Please enter your email address or username.', tone: 'error' });
      return;
    }
    if (!password) {
      setMessage({ text: 'Please enter your password.', tone: 'error' });
      return;
    }

    setSubmitting(true);
    setMessage({ text: 'Signing you in…', tone: 'neutral' });

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password, remember }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setMessage({
          text: body.error ?? 'Sign-in failed. Please try again.',
          tone: 'error',
        });
        setSubmitting(false);
        return;
      }

      setMessage({ text: 'Welcome back. Opening Chigari Dashboard...', tone: 'success' });
      router.replace(next);
      // The dashboard is a large client route; refreshing here makes the
      // server re-read the new session cookie for the protected layout.
      router.refresh();
    } catch {
      setMessage({
        text: 'Could not reach the sign-in service. Check your connection and try again.',
        tone: 'error',
      });
      setSubmitting(false);
    }
  }

  return (
    <section className="login-card" aria-labelledby="login-title">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="card-mark"
        src="/chigari-logo.png"
        width={164}
        height={226}
        alt="Chigari Foundation"
      />
      <hr className="card-rule" />

      <h1 id="login-title">Welcome Back</h1>
      <p className="intro">
        Sign in to access the Chigari Almajiri Education Platform and help build a brighter future
        for our children.
      </p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="username">Email Address or Username</label>
          <div className="input-wrap">
            <svg
              className="input-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="3.2" />
              <path d="M5.5 19c.7-3.2 2.8-4.9 6.5-4.9s5.8 1.7 6.5 4.9" />
            </svg>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              placeholder="Enter your email or username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="input-wrap">
            <svg
              className="input-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <rect x="5" y="10" width="14" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden="true"
              >
                <path d="M2.5 12s3.4-5 9.5-5 9.5 5 9.5 5-3.4 5-9.5 5-9.5-5-9.5-5Z" />
                <circle cx="12" cy="12" r="2.4" />
              </svg>
            </button>
          </div>
        </div>

        <div className="options">
          <div className="remember">
            <input
              id="remember"
              name="remember"
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <label htmlFor="remember">Remember me</label>
          </div>
          <button
            type="button"
            className="forgot"
            onClick={() =>
              setMessage({
                text: 'Password recovery will be connected to the production identity service.',
                tone: 'neutral',
              })
            }
          >
            Forgot password?
          </button>
        </div>

        <button className="primary-btn" type="submit" disabled={submitting}>
          {submitting ? 'Signing In...' : 'Sign In  →'}
        </button>

        <div className="divider" aria-hidden="true">
          <span>OR</span>
        </div>

        <button
          className="sso-btn"
          type="button"
          onClick={() =>
            setMessage({
              text: 'SSO is a prototype action and is not connected yet.',
              tone: 'neutral',
            })
          }
        >
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M12 3 19 6v5c0 4.8-2.9 8-7 10-4.1-2-7-5.2-7-10V6l7-3Z" />
            <path d="m9.3 12 1.8 1.8 3.8-4" />
          </svg>
          Continue with SSO
        </button>

        <div
          className={`message${message.tone === 'neutral' ? '' : ` ${message.tone}`}`}
          role="status"
          aria-live="polite"
        >
          {message.text}
        </div>
      </form>

      {/*
        One notice rather than two. The prototype carried a grey line and an
        amber one saying much the same thing; this states plainly which of the
        two it is, which is what the brief asks for.
      */}
      {isDemo ? (
        <p className="demo-note">
          <b>DEMO SIGN-IN.</b> Accounts are configured for this prototype only and are not a
          production identity service. Authentication can be connected to yours.
        </p>
      ) : (
        <p className="secure-note">
          Authentication is handled by the configured identity service.
        </p>
      )}
    </section>
  );
}
