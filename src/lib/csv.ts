/**
 * Downloads a chart's underlying data.
 *
 * Every file carries the sample-data header, so a spreadsheet that leaves the
 * dashboard still says what it is. If this moves to a server-generated export
 * later, keep the header and the filename shape.
 */
export function downloadCsv(id: string, headers: string[], rows: (string | number)[][]): void {
  const escapeCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const csv = [
    '# SAMPLE DATA - concept prototype',
    headers.join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ].join('\n');

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `sample_${id}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
