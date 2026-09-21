/** Marks an individual record as invented for the demo. */
export function SampleDataBadge({ children = 'Sample record' }: { children?: React.ReactNode }) {
  return <span className="sample-tag">{children}</span>;
}
