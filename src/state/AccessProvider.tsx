'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { type Permission, can } from '@/access/permissions';
import type { SessionUser } from '@/auth/types';

/**
 * What this session may do, inside the dashboard.
 *
 * The same `can()` the API uses answers here, so a control the interface shows
 * and an action the server allows come from one table. Hiding a control is a
 * courtesy — telling someone what they need rather than letting them press a
 * button that fails — and never the enforcement.
 */
interface Access {
  user: SessionUser;
  allows(permission: Permission): boolean;
}

const AccessContext = createContext<Access | null>(null);

export function AccessProvider({ user, children }: { user: SessionUser; children: ReactNode }) {
  const value = useMemo<Access>(
    () => ({
      user,
      allows: (permission) =>
        can(user.role, permission, { verified: user.status === 'VERIFIED' }),
    }),
    [user],
  );
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess(): Access {
  const value = useContext(AccessContext);
  if (!value) throw new Error('useAccess must be used inside an AccessProvider');
  return value;
}
