import type { Metadata } from 'next';
import { AccessCards } from '@/components/portal/AccessCards';
import { PortalFrame } from '@/components/portal/PortalFrame';
import './login.css';

export const metadata: Metadata = {
  title: 'Access Portal · Almajiri Education and Out-of-School Children Platform',
  description:
    'Explore education data from the Chigari Almajiri education ecosystem, or sign in to request controlled datasets.',
};

interface PortalPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

/**
 * The access portal.
 *
 * The brief's principle, and the reason this page exists at all: explore
 * freely, register when you need controlled access. Nobody is asked for an
 * email to look at the platform.
 */
export default async function PortalPage({ searchParams }: PortalPageProps) {
  const params = await searchParams;
  const raw = Array.isArray(params.next) ? params.next[0] : params.next;
  // Only same-origin paths are honoured, so `next` cannot be used to bounce
  // someone off to another site after they come in.
  const next = raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard';

  return (
    <PortalFrame
      layout="portal"
      heading={
        <>
          Welcome to the <em>Chigari Almajiri Education</em> Platform
        </>
      }
      lead="Explore education data, insights, school coverage, learner statistics, infrastructure indicators, and other information from the Chigari Almajiri education ecosystem."
    >
      <AccessCards next={next} />
    </PortalFrame>
  );
}
