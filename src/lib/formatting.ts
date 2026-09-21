/** Number formatting shared by every view, matching the prototype's output. */
export function fmt(n: number): string {
  return Number(n).toLocaleString('en-NG');
}

/** `a` as a whole percentage of `b`. Returns 0 when `b` is 0. */
export function pct(a: number, b: number): number {
  return b ? Math.round((a / b) * 100) : 0;
}

/** Reads a CSS custom property off the document element. */
export function cssVar(name: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Formats a `SchoolRecord.visit` offset as a date.
 * The dataset stores days before {@link DATA_REFERENCE_DATE}.
 */
export function formatVisitDate(daysAgo: number, referenceDate: number): string {
  return new Date(referenceDate - daysAgo * 864e5).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** True when bit `index` is set in a bitmask indicator field. */
export function hasBit(bits: number, index: number): boolean {
  return (bits & (1 << index)) !== 0;
}
