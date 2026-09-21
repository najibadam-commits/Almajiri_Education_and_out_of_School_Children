'use client';

import Chart from 'chart.js/auto';
import { useEffect, useRef, useState } from 'react';
import type { ChartSpec } from '@/lib/charts';
import { downloadCsv } from '@/lib/csv';
import { fmt } from '@/lib/formatting';

/**
 * One chart card: the chart itself, a Table toggle that exposes the same
 * numbers, and a CSV download of those numbers.
 *
 * The Chart.js instance belongs to this card and is destroyed with it, so a
 * filter change updates the data in place rather than leaking canvases.
 */
export function ChartCard({ spec, visible }: { spec: ChartSpec; visible: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const chart = useRef<Chart | null>(null);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    // Chart.js measures its canvas on creation, which reads as zero while the
    // view is hidden, so the chart is built only once this view is on screen.
    if (!visible || !canvas.current) return;

    chart.current?.destroy();
    chart.current = new Chart(canvas.current, spec.config);

    return () => {
      chart.current?.destroy();
      chart.current = null;
    };
  }, [spec.config, visible]);

  const hasData = spec.table.rows.length > 0;

  return (
    <div className={`card${spec.full ? ' full' : ''}${showTable ? ' show-table' : ''}`}>
      <div className="card-head">
        <h3>{spec.title}</h3>
        <div className="tools">
          <button
            onClick={() => setShowTable((v) => !v)}
            aria-pressed={showTable}
            aria-label={`${showTable ? 'Hide' : 'Show'} the data behind ${spec.title}`}
          >
            Table
          </button>
          <button
            onClick={() => downloadCsv(spec.id, spec.table.headers, spec.table.rows)}
            aria-label={`Download ${spec.title} as CSV`}
            disabled={!hasData}
          >
            CSV ↓
          </button>
        </div>
      </div>

      <p className="desc">{spec.desc}</p>

      {spec.legend && spec.legend.length > 0 && (
        <div className="html-legend">
          {spec.legend.map((entry) => (
            <span key={entry.label}>
              {entry.colour !== 'transparent' && <i style={{ background: entry.colour }} />}
              {entry.label}
            </span>
          ))}
        </div>
      )}

      <div className="chart-box">
        {hasData ? (
          <canvas
            ref={canvas}
            role="img"
            aria-label={`${spec.title} chart. Use the Table button for the values.`}
          />
        ) : (
          <div className="chart-state">
            No data for this chart with the current filters.
            <br />
            Try removing one or more filters.
          </div>
        )}
      </div>

      <div className="tbl">
        <table className="data">
          <thead>
            <tr>
              {spec.table.headers.map((header, i) => (
                <th key={header} className={i ? 'num' : undefined}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {spec.table.rows.map((row, rowIndex) => (
              <tr key={`${row[0]}-${rowIndex}`}>
                {row.map((cell, i) => (
                  <td key={i} className={i ? 'num' : undefined}>
                    {i ? fmt(Number(cell)) : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
