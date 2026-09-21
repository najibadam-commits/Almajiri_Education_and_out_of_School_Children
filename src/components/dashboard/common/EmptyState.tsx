interface EmptyStateProps {
  /** What the user is looking at that has nothing in it. */
  title: string;
  /** What they can do about it. */
  hint?: string;
  className?: string;
}

/**
 * Shown wherever a filtered set comes back empty, so a view never goes blank
 * without saying why.
 */
export function EmptyState({
  title,
  hint = 'Try removing one or more filters.',
  className,
}: EmptyStateProps) {
  return (
    <div className={`empty${className ? ` ${className}` : ''}`}>
      <div>{title}</div>
      {hint && <div style={{ marginTop: 6, fontSize: 12.5 }}>{hint}</div>}
    </div>
  );
}
