'use client';

import Chart from 'chart.js/auto';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { ChartSpec } from '@/lib/charts';
import { downloadCsv } from '@/lib/csv';
import { fmt } from '@/lib/formatting';
import { useAccess } from '@/state/AccessProvider';
import { CloseButton, Modal } from '../modals/Modal';

/**
 * One chart card: the chart itself, a Table toggle that exposes the same
 * numbers, and a CSV download of those numbers.
 *
 * The Chart.js instance belongs to this card and is destroyed with it, so a
 * filter change updates the data in place rather than leaking canvases.
 *
 * A visitor gets the chart and the table but not the export, and is told why
 * rather than shown a control that does nothing. This is a matter of product
 * policy, not of secrecy: these numbers are already on screen, and the export
 * is built in the browser from what the browser has. The downloads that are
 * actually protected are the dataset files, which a route handler serves only
 * against an approved request — see /api/downloads.
 */
export function ChartCard({ spec, visible }: { spec: ChartSpec; visible: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const chart = useRef<Chart | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [askedToDownload, setAskedToDownload] = useState(false);
  const { allows, user } = useAccess();
  const mayExport = allows('DOWNLOAD_APPROVED_DATA');

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
            onClick={() =>
              mayExport
                ? downloadCsv(spec.id, spec.table.headers, spec.table.rows)
                : setAskedToDownload(true)
            }
            aria-label={
              mayExport
                ? `Download ${spec.title} as CSV`
                : `Downloading ${spec.title} needs an account`
            }
            className={mayExport ? undefined : 'locked'}
            disabled={!hasData}
          >
            CSV {mayExport ? '↓' : '🔒'}
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

      <Modal
        open={askedToDownload}
        onClose={() => setAskedToDownload(false)}
        labelledBy="account-required-title"
        small
      >
        <div className="dlg-head">
          <div>
            <h3 id="account-required-title">Account Required</h3>
          </div>
          <CloseButton onClose={() => setAskedToDownload(false)} />
        </div>
        <div className="dlg-body">
          {user.role === 'VISITOR' ? (
            <>
              <p>
                You are browsing as a visitor. Everything on this dashboard is open to you to read,
                but exporting data needs a registered account.
              </p>
              <p>
                Creating one takes a minute. Controlled datasets are then released by request, and
                an administrator reviews each one.
              </p>
              <div className="dlg-actions">
                <Link className="btn primary" href="/register">
                  Create Account
                </Link>
                <Link className="btn" href="/login/sign-in">
                  Sign In
                </Link>
              </div>
            </>
          ) : (
            <>
              <p>
                Confirm your email address to export data. The confirmation link was issued when
                you registered.
              </p>
              <div className="dlg-actions">
                <Link className="btn primary" href="/account/requests">
                  My Data Requests
                </Link>
              </div>
            </>
          )}
        </div>
      </Modal>

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
