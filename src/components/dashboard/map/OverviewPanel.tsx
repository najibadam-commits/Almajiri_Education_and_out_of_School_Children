'use client';

import { useMemo } from 'react';
import { Kpi } from '@/components/dashboard/common/Kpi';
import { countBy } from '@/lib/aggregations';
import { fmt, pct } from '@/lib/formatting';
import { useDashboard } from '@/state/DashboardProvider';

const TOP_LIST_SIZE = 6;

/**
 * The overview panel beside the map.
 *
 * Every figure is computed from the schools currently passing the filters, so
 * it always describes exactly what the map is showing.
 */
export function OverviewPanel() {
  const { state, filtered, aggregates: a, scope } = useDashboard();

  const { top, topTitle } = useMemo(() => {
    const national = state.st === '';
    const counts = countBy(filtered, national ? 'stateName' : 'lgaName');
    const sorted = [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, TOP_LIST_SIZE);
    return {
      top: sorted,
      topTitle: national
        ? 'Top states by schools'
        : state.lga === ''
          ? 'Top LGAs by schools'
          : 'Schools in this LGA',
    };
  }, [filtered, state.st, state.lga]);

  const topMax = top.length ? top[0][1] : 1;

  return (
    <div className="panel" aria-label="Overview">
      <h2>OVERVIEW</h2>
      <div className="scope">{scope}</div>

      <div className="kpis">
        <Kpi wide value={a.n} label="Almajiri / Tsangaya schools" />
        <Kpi value={a.pupils} label="Enrolled pupils" />
        <Kpi value={a.mallams} label="Mallams (teachers)" />
        <Kpi
          value={a.integ}
          label="Integrated schools"
          sub={`${pct(a.integ, a.n)}% teach basic literacy/numeracy`}
        />
        <Kpi value={a.chig} label="Chigari-supported" sub={`${pct(a.chig, a.n)}% of schools`} />
        <Kpi value={a.ratio} label="Pupils per Mallam" />
        <Kpi value={`${pct(a.health[0], a.n)}%`} label="Schools reached in last polio round" />
      </div>

      <div className="toplist">
        <h3>{topTitle}</h3>
        {top.length === 0 ? (
          <div className="empty" style={{ padding: 10 }}>
            No schools match
          </div>
        ) : (
          top.map(([name, value]) => (
            <div className="bar-row" key={name}>
              <span className="n" title={name}>
                {name}
              </span>
              <span className="track">
                <span
                  className="fill"
                  style={{ width: `${(value / topMax) * 100}%`, display: 'block' }}
                />
              </span>
              <span className="val">{fmt(value)}</span>
            </div>
          ))
        )}
      </div>

      <div className="updated">
        Last updated: 01 Sep 2026 (sample)
        <br />
        Data source: placeholder dataset generated for this demo
      </div>
    </div>
  );
}
