'use client';

import type { ViewKey } from '@/data/types';
import { useDashboard } from '@/state/DashboardProvider';

const VIEWS: { value: ViewKey; label: string }[] = [
  { value: 'map', label: 'Map' },
  { value: 'chart', label: 'Chart' },
  { value: 'grid', label: 'Grid' },
];

/**
 * Map / Chart / Grid. These stay one dashboard-level switch rather than three
 * routes, because the filters and the scope carry across all three.
 */
export function ViewSwitcher() {
  const { state, setView } = useDashboard();

  return (
    <div className="views" role="radiogroup" aria-label="View">
      {VIEWS.map((view) => (
        <label key={view.value}>
          <input
            type="radio"
            name="view"
            value={view.value}
            checked={state.view === view.value}
            onChange={() => setView(view.value)}
          />
          {view.label}
        </label>
      ))}
    </div>
  );
}
