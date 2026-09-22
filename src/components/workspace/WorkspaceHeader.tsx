'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { roleLabel } from '@/access/permissions';
import type { SessionUser } from '@/auth/types';

/**
 * The header the account and administration pages share.
 *
 * It carries the same branding as the dashboard, the navigation the brief asks
 * for, and the access badge that says plainly what this session is. The links
 * shown depend on the role, but that is a courtesy only: every page and route
 * behind them checks the session for itself.
 */
export function WorkspaceHeader({ user }: { user: SessionUser }) {
  const router = useRouter();
  const pathname = usePathname();
  const isVisitor = user.role === 'VISITOR';

  const links = [
    { href: '/dashboard', label: 'Dashboard', show: true },
    { href: '/account/requests', label: 'My Data Requests', show: !isVisitor },
    { href: '/admin/requests', label: 'Administration', show: user.role === 'ADMINISTRATOR' },
  ].filter((link) => link.show);

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    router.replace('/login');
    router.refresh();
  }

  return (
    <header className="ws-top">
      <Link className="ws-brand" href="/dashboard">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/chigari-logo.png" alt="" aria-hidden="true" />
        <span>
          <b>Chigari Foundation</b>
          <small>Almajiri Education Information System · concept</small>
        </span>
      </Link>

      <nav className="ws-nav" aria-label="Sections">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={pathname === link.href ? 'page' : undefined}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="ws-account">
        <span className={`access-badge${isVisitor ? ' visitor' : ''}`}>{roleLabel(user.role)}</span>
        <span className="ws-who">{user.name}</span>
        <button className="ws-signout" onClick={signOut}>
          {isVisitor ? 'Exit Visitor Mode' : 'Log out'}
        </button>
      </div>
    </header>
  );
}
