import type { ReactNode } from 'react';

/**
 * The chrome every access screen shares: the photograph, the wash, the
 * Commission masthead, the narration and the commitments strip.
 *
 * It was the login page's markup; the portal, sign-in, registration and
 * verification screens all sit inside it now so that moving between them
 * changes only the panel on the right.
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

interface PortalFrameProps {
  /** The heading and supporting line on the left. */
  heading: ReactNode;
  lead: string;
  children: ReactNode;
  /**
   * `portal` gives the right-hand column room for two access cards; `form` is
   * the single-card width the sign-in card has always used.
   */
  layout?: 'portal' | 'form';
}

export function PortalFrame({ heading, lead, children, layout = 'form' }: PortalFrameProps) {
  return (
    <main className={`login-page${layout === 'portal' ? ' portal' : ''}`}>
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
          <h1>{heading}</h1>
          <p>{lead}</p>
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

        {children}
      </div>
    </main>
  );
}
