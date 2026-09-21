'use client';

import { useDashboard } from '@/state/DashboardProvider';

export function Toast() {
  const { toast } = useDashboard();
  return (
    <div className={`toast${toast ? ' on' : ''}`} role="status">
      {toast}
    </div>
  );
}
