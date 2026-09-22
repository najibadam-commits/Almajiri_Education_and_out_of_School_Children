import type { Metadata } from 'next';
import Link from 'next/link';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { PortalFrame } from '@/components/portal/PortalFrame';
import '../login/login.css';

export const metadata: Metadata = {
  title: 'Create an account · Almajiri Education and Out-of-School Children Platform',
  description: 'Register for an account to request controlled datasets.',
};

interface RegisterPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const raw = Array.isArray(params.next) ? params.next[0] : params.next;
  const next = raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard';

  return (
    <PortalFrame
      heading={
        <>
          Register for <em>controlled data access</em>
        </>
      }
      lead="Anyone can explore the platform without an account. Registration is what lets you ask for a dataset, and gives the Commission a record of who asked and why."
    >
      <div className="portal-panel">
        <RegisterForm next={next} />
        <p className="panel-back">
          <Link href={`/login?next=${encodeURIComponent(next)}`}>← Back to access options</Link>
        </p>
      </div>
    </PortalFrame>
  );
}
