'use client';

import { useEffect, useRef, useState } from 'react';
import { useDashboard } from '@/state/DashboardProvider';

/** Basemap choice and the three overlay toggles. */
export function MapLayersControl() {
  const { layers, setLayers } = useDashboard();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocumentClick = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDocumentClick);
    return () => document.removeEventListener('click', onDocumentClick);
  }, [open]);

  return (
    <div className="layer-box" ref={box}>
      <button
        className="icon-btn"
        aria-label="Map layers"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m12 3 9 5-9 5-9-5 9-5z" />
          <path d="m3 13 9 5 9-5" />
        </svg>
      </button>

      <div className={`layer-pop${open ? ' on' : ''}`}>
        <h4>BASEMAP</h4>
        <label>
          <input
            type="radio"
            name="bm"
            value="offline"
            checked={layers.basemap === 'offline'}
            onChange={() => setLayers({ basemap: 'offline' })}
          />{' '}
          Built-in map
        </label>
        <label>
          <input
            type="radio"
            name="bm"
            value="none"
            checked={layers.basemap === 'none'}
            onChange={() => setLayers({ basemap: 'none' })}
          />{' '}
          None
        </label>

        <h4>OVERLAYS</h4>
        <label>
          <input
            type="checkbox"
            checked={layers.choropleth}
            onChange={(e) => setLayers({ choropleth: e.target.checked })}
          />{' '}
          Shade areas by school count
        </label>
        <label>
          <input
            type="checkbox"
            checked={layers.badges}
            onChange={(e) => setLayers({ badges: e.target.checked })}
          />{' '}
          Count bubbles
        </label>
        <label>
          <input
            type="checkbox"
            checked={layers.points}
            onChange={(e) => setLayers({ points: e.target.checked })}
          />{' '}
          School locations (LGA / state view)
        </label>
      </div>
    </div>
  );
}
