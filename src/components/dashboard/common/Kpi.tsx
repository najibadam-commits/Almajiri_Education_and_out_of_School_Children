import { fmt } from '@/lib/formatting';

interface KpiProps {
  /** Already-formatted value, or a number to format. */
  value: string | number;
  label: string;
  /** Optional line under the label. */
  sub?: string;
  /** Spans the full width of the KPI grid. */
  wide?: boolean;
}

export function Kpi({ value, label, sub, wide }: KpiProps) {
  return (
    <div className={`kpi${wide ? ' wide' : ''}`}>
      <div className="v">{typeof value === 'number' ? fmt(value) : value}</div>
      <div className="l">{label}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
