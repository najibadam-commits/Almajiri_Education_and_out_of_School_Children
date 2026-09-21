'use client';

import { SEQUENTIAL_STEPS } from '@/lib/map';
import { fmt } from '@/lib/formatting';

export interface LegendState {
  /** What the shading counts. */
  title: string;
  /** The top of the ramp. */
  max: number;
  /** True when individual schools are drawn, so the type key is relevant. */
  showTypes: boolean;
}

interface MapLegendProps {
  legend: LegendState | null;
  showChoropleth: boolean;
  types: string[];
}

export function MapLegend({ legend, showChoropleth, types }: MapLegendProps) {
  if (!legend) return null;
  const { title, max, showTypes } = legend;
  if (!showChoropleth && !showTypes) return null;

  return (
    <div className="legend">
      {showChoropleth && (
        <>
          <div className="ttl">{title}</div>
          <div className="ramp">
            {SEQUENTIAL_STEPS.map((step) => (
              <i key={step} style={{ background: `var(${step})` }} />
            ))}
          </div>
          <div className="ends">
            <span>1</span>
            <span>{fmt(max)}</span>
          </div>
        </>
      )}
      {showTypes && (
        <>
          <div className="ttl" style={{ marginTop: showChoropleth ? 8 : 0 }}>
            School type
          </div>
          {types.map((type, index) => (
            <div className="row" key={type}>
              <span
                className={index === 3 ? 'dia' : 'dot'}
                style={{ background: `var(--series-${index + 1})` }}
              />
              {type}
            </div>
          ))}
          <div className="row" style={{ fontSize: 10.5 }}>
            Faded dot = inactive school
          </div>
        </>
      )}
    </div>
  );
}
