import type { Metadata } from 'next';
import { authService } from '@/auth/authService';
import { LoginForm } from '@/components/auth/LoginForm';
import './login.css';

export const metadata: Metadata = {
  title: 'Sign in · Almajiri Education and Out-of-School Children Platform',
  description: 'Sign in to the Almajiri Education and Out-of-School Children Platform.',
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

/**
 * The four commitments that ran along the foot of the prototype's login
 * artwork. They were painted into the image; here they are markup, so they
 * re-flow and stay legible at every width.
 */
const PILLARS = [
  {
    lead: 'Track',
    rest: 'Learners',
    icon: (
      <>
        <circle cx="12" cy="8" r="3.4" />
        <path d="M5 19.5c.8-3.6 3.1-5.4 7-5.4s6.2 1.8 7 5.4" />
      </>
    ),
  },
  {
    lead: 'Monitor',
    rest: 'Tsangaya Centres',
    icon: (
      <>
        <path d="M4 10.6 12 4l8 6.6" />
        <path d="M6 10v9.5h12V10" />
        <path d="M10 19.5v-5h4v5" />
      </>
    ),
  },
  {
    lead: 'Support',
    rest: 'Child Wellbeing',
    icon: (
      <>
        <path d="M12 20s-7-4.3-7-9.2A4 4 0 0 1 12 8a4 4 0 0 1 7-.8c0 4.9-7 12.8-7 12.8Z" />
        <path d="M4.5 13h3l1.5-2.5L11 15l1.8-4 1.2 2h5" />
      </>
    ),
  },
  {
    lead: 'Data-Driven',
    rest: 'Decisions',
    icon: (
      <>
        <path d="M4 20h16" />
        <path d="M7 20v-6.5" />
        <path d="M12 20V7" />
        <path d="M17 20v-9.5" />
      </>
    ),
  },
];

/**
 * The login page.
 *
 * The artwork the prototype used was a flattened page mock-up with the
 * headline, the wordmark, the navigation and the footer strip painted into
 * it. All of that is markup now and the image is only the photograph, so the
 * narration can be edited, the type re-flows instead of being cropped, and
 * the two institutional marks can sit where they belong.
 *
 * Whether sign-in is backed by the demo provider is decided on the server and
 * passed down, so the page can say plainly that it is a demo without the
 * browser having to guess.
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const raw = Array.isArray(params.next) ? params.next[0] : params.next;
  // Only same-origin paths are honoured, so `next` cannot be used to bounce
  // someone off to another site after they sign in.
  const next = raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard';

  return (
    <main className="login-page">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="login-photo"
        src="/chigari-login-photo.png"
        alt="Almajiri pupils reading at a Tsangaya centre"
      />
      <div className="login-scrim" aria-hidden="true" />

      <div className="login-shell">
        <header className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="brand-mark"
            src="/national-commission-logo.png"
            width={512}
            height={512}
            alt="National Commission for Almajiri and Out-of-School Children Education"
          />
          <span className="brand-name">
            <strong>National Commission for Almajiri</strong>
            <span>and Out-of-School Children Education</span>
          </span>
        </header>

        <section className="hero">
          <h1>
            Digitally Empowering{' '}
            <em>Almajiri Education and out of School Children</em> in Nigeria
          </h1>
          <p>Better data. Stronger Tsangaya. Brighter futures for every child.</p>
        </section>

        <ul className="pillars">
          {PILLARS.map((pillar) => (
            <li key={pillar.lead}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {pillar.icon}
              </svg>
              <span>
                <b>{pillar.lead}</b>
                {pillar.rest}
              </span>
            </li>
          ))}
        </ul>

        <LoginForm next={next} isDemo={authService.isDemo} />
      </div>
    </main>
  );
}
