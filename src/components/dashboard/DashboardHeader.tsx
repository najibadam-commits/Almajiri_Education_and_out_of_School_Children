'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { roleLabel } from '@/access/permissions';
import type { SessionUser } from '@/auth/types';
import { useDashboard } from '@/state/DashboardProvider';
import { SearchBox } from './SearchBox';

interface DashboardHeaderProps {
  user: SessionUser;
  /** Opens the filter drawer on narrow screens. */
  onOpenFilters: () => void;
}

/**
 * The dashboard header: branding, search, and the location, theme and account
 * controls. The branding and the search placeholder are the prototype's and
 * change only if the product owner asks.
 */
export function DashboardHeader({ user, onOpenFilters }: DashboardHeaderProps) {
  const router = useRouter();
  const { setView, setZone, setStateFilter, toggleTheme } = useDashboard();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocumentClick = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onDocumentClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  /** Returns the map to the national view, as the prototype's pin button does. */
  function zoomToNigeria() {
    setView('map');
    setZone('');
    setStateFilter('');
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      // Whatever the network did, send the user to the login page: the
      // middleware is the thing that actually decides whether they get back in.
      router.replace('/login');
      router.refresh();
    }
  }

  const isVisitor = user.role === 'VISITOR';
  const pending = !isVisitor && user.status !== 'VERIFIED';

  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <header className="top">
      <button className="icon-btn menu-btn" onClick={onOpenFilters} aria-label="Open filters">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/chigari-logo.png" alt="Chigari Foundation" />
        <div className="brand-text">
          <div className="org">Chigari Foundation</div>
          <div className="sys">Almajiri Education Information System · concept</div>
        </div>
      </div>

      <SearchBox />

      <div className="top-actions">
        {/*
         * What this session is, said out loud. A visitor should never have to
         * work out why a control is missing, and someone with an account
         * should be able to see that they have one.
         */}
        <span className={`access-badge${isVisitor ? ' visitor' : ''}`} title="Your access level">
          {roleLabel(user.role)}
        </span>

        <button
          className="icon-btn"
          onClick={zoomToNigeria}
          aria-label="Zoom to Nigeria"
          title="Zoom to Nigeria"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
        </button>

        <button
          className="icon-btn"
          onClick={toggleTheme}
          aria-label="Toggle light or dark theme"
          title="Light / dark"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </svg>
        </button>

        <div className="user-menu" ref={menu}>
          <button
            className="icon-btn user-btn"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label={`Account: ${user.name}`}
            title={user.name}
          >
            {initials || '?'}
          </button>
          {menuOpen && (
            <div className="user-pop" role="menu">
              <div className="who">
                <b>{user.name}</b>
                <span>{user.title}</span>
              </div>

              {isVisitor ? (
                <>
                  <p className="pop-note">
                    You are browsing without an account. Downloads and dataset requests need one.
                  </p>
                  <Link className="btn primary" role="menuitem" href="/register">
                    Create Account
                  </Link>
                  <Link className="btn" role="menuitem" href="/login/sign-in">
                    Sign In
                  </Link>
                </>
              ) : (
                <>
                  {pending && (
                    <p className="pop-note">
                      Confirm your email address to request datasets.
                    </p>
                  )}
                  <Link className="btn" role="menuitem" href="/account/requests">
                    My Data Requests
                  </Link>
                  {user.role === 'ADMINISTRATOR' && (
                    <Link className="btn" role="menuitem" href="/admin/requests">
                      Review Requests
                    </Link>
                  )}
                </>
              )}

              <button className="btn" role="menuitem" onClick={signOut} disabled={signingOut}>
                {signingOut ? 'Signing out…' : isVisitor ? 'Exit Visitor Mode' : 'Log out'}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
