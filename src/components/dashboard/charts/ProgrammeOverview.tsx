'use client';

import { useMemo } from 'react';
import { Credits } from '@/components/dashboard/common/Credits';
import { buildCharts, buildTiles } from '@/lib/charts';
import { useDashboard } from '@/state/DashboardProvider';
import { ChartCard } from './ChartCard';

/**
 * The chart view. Everything on it is scoped by the current filters, and the
 * scope line beside the heading says so.
 */
export function ProgrammeOverview({ active }: { active: boolean }) {
  const { state, filtered, aggregates, scope, states, lgas, catalog, theme } = useDashboard();

  // Rebuilt when the data, the scope or the theme changes: the chart colours
  // are read from CSS custom properties, so a theme switch changes them.
  const charts = useMemo(
    () =>
      buildCharts({
        state,
        list: filtered,
        aggregates,
        states,
        lgas,
        types: catalog.types,
        zone: state.zone,
      }),
    [state, filtered, aggregates, states, lgas, catalog.types],
  );

  const tiles = useMemo(() => buildTiles(aggregates), [aggregates]);

  return (
    <section className={`view${active ? ' on' : ''}`} aria-label="Chart view" aria-hidden={!active}>
      <div className="scroll">
        <div className="view-head">
          <h1>Programme overview</h1>
          <span className="scope">· {scope} · sample data</span>
        </div>

        <div className="tiles">
          {tiles.map((tile) => (
            <div className="tile" key={tile.label}>
              <button className="info" data-tip={tile.tip} aria-label={tile.tip}>
                i
              </button>
              <div className="v">{tile.value}</div>
              <div className="l">{tile.label}</div>
            </div>
          ))}
        </div>

        <div className="charts">
          {charts.map((spec) => (
            // Keyed by theme so a theme switch rebuilds the canvas with the
            // new palette rather than repainting the old one.
            <ChartCard key={`${spec.id}-${theme}`} spec={spec} visible={active} />
          ))}
        </div>

        <Credits />
      </div>
    </section>
  );
}
