'use client';

import { useMemo } from 'react';
import { Credits } from '@/components/dashboard/common/Credits';
import { EmptyState } from '@/components/dashboard/common/EmptyState';
import { PAGE_SIZE } from '@/data/indicators';
import type { SchoolRecord, SortKey } from '@/data/types';
import { fmt } from '@/lib/formatting';
import { useDashboard } from '@/state/DashboardProvider';
import { SchoolCard } from './SchoolCard';

const SORTERS: Record<SortKey, (x: SchoolRecord, y: SchoolRecord) => number> = {
  // `visit` counts days since the last visit, so ascending is most recent.
  visit: (x, y) => x.visit - y.visit,
  pupils: (x, y) => y.pupils - x.pupils,
  rating: (x, y) => y.rating - x.rating,
  name: (x, y) => x.name.localeCompare(y.name),
};

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'visit', label: 'Most recently visited' },
  { value: 'pupils', label: 'Most pupils' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'name', label: 'Name (A–Z)' },
];

/** The grid view: school records as cards, loaded a page at a time. */
export function SchoolGrid({ active }: { active: boolean }) {
  const { state, filtered, scope, catalog, setSort, loadMore, openProfile, openFeedback } =
    useDashboard();

  // Sorted on a copy: `filtered` is memoised upstream and shared with the map
  // and the charts, so sorting it in place would reorder their data too.
  const sorted = useMemo(() => [...filtered].sort(SORTERS[state.sort]), [filtered, state.sort]);

  const shown = useMemo(() => sorted.slice(0, state.page * PAGE_SIZE), [sorted, state.page]);

  return (
    <section className={`view${active ? ' on' : ''}`} aria-label="Grid view" aria-hidden={!active}>
      <div className="scroll">
        <div className="grid-bar">
          <span className="count">
            Showing {fmt(shown.length)} of {fmt(sorted.length)} sample schools · {scope}
          </span>
          <label htmlFor="sortSel" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            Sort
          </label>
          <select
            id="sortSel"
            value={state.sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="cards">
          {shown.length === 0 ? (
            <EmptyState
              title="No sample schools match these filters."
              hint="Try removing a filter."
              className="grid-empty"
            />
          ) : (
            shown.map((school) => (
              <SchoolCard
                key={school.id}
                school={school}
                typeLabel={catalog.types[school.type]}
                onView={openProfile}
                onFeedback={openFeedback}
              />
            ))
          )}
        </div>

        {shown.length < sorted.length && (
          <button className="btn more" onClick={loadMore}>
            Load more
          </button>
        )}

        <Credits />
      </div>
    </section>
  );
}
