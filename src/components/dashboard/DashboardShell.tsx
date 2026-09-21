'use client';

import { useEffect, useState } from 'react';
import type { SessionUser } from '@/auth/types';
import { useDashboard } from '@/state/DashboardProvider';
import { DashboardHeader } from './DashboardHeader';
import { FilterSidebar } from './FilterSidebar';
import { ProgrammeOverview } from './charts/ProgrammeOverview';
import { ConceptRibbon } from './common/ConceptRibbon';
import { Toast } from './common/Toast';
import { SchoolGrid } from './grid/SchoolGrid';
import { MapView } from './map/MapView';
import { FeedbackModal } from './modals/FeedbackModal';
import { SchoolProfileModal } from './modals/SchoolProfileModal';

/**
 * The dashboard shell: ribbon, header, filter sidebar and the three views.
 *
 * All three views stay mounted and are shown or hidden, so switching between
 * them keeps the map instance, the scroll position and the filters intact.
 */
export function DashboardShell({ user }: { user: SessionUser }) {
  const { status, error, retry, state } = useDashboard();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Choosing a view from inside the mobile drawer closes it.
  useEffect(() => {
    setDrawerOpen(false);
  }, [state.view]);

  return (
    <>
      <div className="app">
        <ConceptRibbon />
        <DashboardHeader user={user} onOpenFilters={() => setDrawerOpen(true)} />

        <div className={`body${collapsed ? ' collapsed' : ''}${drawerOpen ? ' drawer' : ''}`}>
          <div className="scrim" onClick={() => setDrawerOpen(false)} />

          <aside className="side" aria-label="Filters">
            {status === 'ready' && <FilterSidebar />}
          </aside>

          <button
            className="collapse-btn"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand filter panel' : 'Collapse filter panel'}
            aria-expanded={!collapsed}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="m11 17-5-5 5-5M18 17l-5-5 5-5" />
            </svg>
          </button>

          <main>
            {status === 'loading' && (
              <div className="state-pane">
                <div className="inner">
                  <div className="spinner" />
                  <h2>Loading the sample dataset</h2>
                  <p>Reading school records, states and LGAs.</p>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="state-pane">
                <div className="inner">
                  <h2>The dashboard data could not be loaded</h2>
                  <p>{error}</p>
                  <button className="btn primary" onClick={retry}>
                    Try again
                  </button>
                </div>
              </div>
            )}

            {status === 'ready' && (
              <>
                <MapView active={state.view === 'map'} />
                <ProgrammeOverview active={state.view === 'chart'} />
                <SchoolGrid active={state.view === 'grid'} />
              </>
            )}
          </main>
        </div>
      </div>

      <SchoolProfileModal />
      <FeedbackModal />
      <Toast />
    </>
  );
}
