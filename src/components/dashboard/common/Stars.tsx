'use client';

import { useId } from 'react';

/**
 * One star, filled from the left by `fill` (0 to 1).
 *
 * The prototype generated a random gradient id per star; using React's id
 * hook instead keeps the markup stable across re-renders.
 */
function Star({ fill, index }: { fill: number; index: number }) {
  const baseId = useId();
  const gradientId = `${baseId}-${index}`.replace(/:/g, '');
  const stop = `${Math.max(0, Math.min(1, fill)) * 100}%`;

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId}>
          <stop offset={stop} stopColor="var(--series-4)" />
          <stop offset={stop} stopColor="var(--border)" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradientId})`}
        d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
      />
    </svg>
  );
}

/** A five-star rating display. */
export function Stars({ rating }: { rating: number }) {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} index={i} fill={rating - i} />
      ))}
    </>
  );
}
