import type { Metadata } from 'next';
import Link from 'next/link';
import { authService } from '@/auth/authService';
import { LoginForm } from '@/components/auth/LoginForm';
import { PortalFrame } from '@/components/portal/PortalFrame';
import '../login.css';

export const metadata: Metadata = {
  title: 'Sign in · Almajiri Education and Out-of-School Children Platform',
  description: 'Sign in to the Almajiri Education and Out-of-School Children Platform.',
};

interface SignInPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const raw = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard';

  return (
    <PortalFrame
      heading={
        <>
          Digitally Empowering <em>Almajiri Education and out of School Children</em> in Nigeria
        </>
      }
      lead="Better data. Stronger Tsangaya. Brighter futures for every child."
    >
      <div className="portal-panel">
        <LoginForm next={next} isDemo={authService.isDemo} />
        <p className="panel-back">
          <Link href={`/login?next=${encodeURIComponent(next)}`}>← Back to access options</Link>
        </p>
      </div>
    </PortalFrame>
  );
}
