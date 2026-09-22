import type { Metadata } from 'next';
import Link from 'next/link';
import { VerifyPanel } from '@/components/auth/VerifyPanel';
import { PortalFrame } from '@/components/portal/PortalFrame';
import '../login/login.css';

export const metadata: Metadata = {
  title: 'Confirm your email · Almajiri Education and Out-of-School Children Platform',
  robots: { index: false, follow: false },
};

interface VerifyPageProps {
  searchParams: Promise<{ token?: string | string[] }>;
}

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const params = await searchParams;
  const token = (Array.isArray(params.token) ? params.token[0] : params.token) ?? '';

  return (
    <PortalFrame
      heading={
        <>
          Finish setting up your <em>platform account</em>
        </>
      }
      lead="Confirming your address is what turns a pending registration into an account that can request controlled datasets."
    >
      <div className="portal-panel">
        <VerifyPanel token={token} />
        <p className="panel-back">
          <Link href="/login">← Back to access options</Link>
        </p>
      </div>
    </PortalFrame>
  );
}
