'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { MapBreadcrumb } from './MapBreadcrumb';
import { MapLayersControl } from './MapLayersControl';
import { OverviewPanel } from './OverviewPanel';

/**
 * Leaflet reaches for `window` and `document` as soon as it is evaluated, so
 * the map is loaded in the browser only. Nothing here runs on the server.
 */
const SchoolMap = dynamic(() => import('./SchoolMap').then((m) => m.SchoolMap), {
  ssr: false,
  loading: () => (
    <div className="state-pane">
      <div className="inner">
        <div className="spinner" />
        <p>Loading the map…</p>
      </div>
    </div>
  ),
});

export function MapView({ active }: { active: boolean }) {
  const [panelOpen, setPanelOpen] = useState(true);
  const [detailed, setDetailed] = useState(false);

  return (
    <section
      className={`view${active ? ' on' : ''}${panelOpen ? '' : ' no-panel'}`}
      id="mapView"
      aria-label="Map view"
      aria-hidden={!active}
    >
      <div className="map-wrap">
        <SchoolMap active={active} onDetailedChange={setDetailed} />
        <MapBreadcrumb detailed={detailed} />
        <MapLayersControl />
      </div>

      <OverviewPanel />

      <button
        className="icon-btn panel-toggle"
        onClick={() => setPanelOpen((open) => !open)}
        aria-label={panelOpen ? 'Hide overview panel' : 'Show overview panel'}
        aria-expanded={panelOpen}
        title="Show / hide overview"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M15 4v16" />
        </svg>
      </button>
    </section>
  );
}
