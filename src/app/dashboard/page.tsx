import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getCurrentUser } from '@/auth/currentUser';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardProvider } from '@/state/DashboardProvider';

export const metadata: Metadata = {
  title: 'Dashboard · CHIGARI Almajiri Education Information System',
};

/**
 * The dashboard.
 *
 * The middleware already turns unauthenticated requests away; reading the user
 * again here is what makes the page itself refuse to render without a session,
 * rather than relying on the redirect alone.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/dashboard');

  return (
    <Suspense fallback={null}>
      <DashboardProvider>
        <DashboardShell user={user} />
      </DashboardProvider>
    </Suspense>
  );
}
