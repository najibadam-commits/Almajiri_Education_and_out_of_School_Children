'use client';

import { useDashboard } from '@/state/DashboardProvider';

/**
 * The geographic breadcrumb: Nigeria › Zone › State › LGA.
 *
 * Every level above the current one is a button, so the breadcrumb is how the
 * user walks back up the hierarchy.
 */
export function MapBreadcrumb({ detailed }: { detailed: boolean }) {
  const { state, states, lgas, setZone, setStateFilter, setLgaFilter } = useDashboard();

  const hint =
    state.st === ''
      ? 'Click a state to drill down'
      : state.lga === ''
        ? detailed
          ? 'Click a school or an LGA'
          : 'Click an LGA or zoom in to see schools'
        : 'Click a school for details';

  return (
    <div className="map-crumb">
      <button onClick={() => setZone('')}>Nigeria</button>

      {state.zone && (
        <>
          <span className="sep">›</span>
          {state.st === '' ? (
            <b>{state.zone}</b>
          ) : (
            <button onClick={() => setStateFilter('')}>{state.zone}</button>
          )}
        </>
      )}

      {state.st !== '' && (
        <>
          <span className="sep">›</span>
          {state.lga === '' ? (
            <b>{states[Number(state.st)]?.name}</b>
          ) : (
            <button onClick={() => setLgaFilter('')}>{states[Number(state.st)]?.name}</button>
          )}
        </>
      )}

      {state.lga !== '' && (
        <>
          <span className="sep">›</span>
          <b>{lgas[Number(state.lga)]?.name}</b>
        </>
      )}

      <span className="sep">·</span>
      <span style={{ color: 'var(--text-muted)' }}>{hint}</span>
    </div>
  );
}
