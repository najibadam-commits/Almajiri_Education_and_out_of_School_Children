import type { Metadata } from 'next';
import { authService } from '@/auth/authService';
import { LoginForm } from '@/components/auth/LoginForm';
import './login.css';

export const metadata: Metadata = {
  title: 'Sign in · CHIGARI Almajiri Education Platform',
  description: 'Sign in to the Chigari Almajiri Education Platform.',
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string | string[] }>;
}

/**
 * The login page.
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
        className="background"
        src="/chigari-login-background.png"
        alt="Almajiri and Tsangaya education background"
      />
      <div className="shade" aria-hidden="true" />
      <LoginForm next={next} isDemo={authService.isDemo} />
    </main>
  );
}
