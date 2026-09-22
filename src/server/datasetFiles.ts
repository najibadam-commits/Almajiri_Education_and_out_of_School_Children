// Imported only from route handlers. The payloads are bundled here rather
// than fetched so a dataset's location never reaches the browser.
import catalog from '../../public/data/catalog.json';
import places from '../../public/data/places.json';
import schoolsFile from '../../public/data/schools.json';
import { CURRICULUM, HEALTH, INFRASTRUCTURE } from '@/data/indicators';
import type { Dataset } from '@/store/types';

/**
 * Renders an approved dataset.
 *
 * This module is server-only and the payloads are imported here rather than
 * fetched, so a dataset's location never reaches the browser and a download is
 * always produced by a route that has already checked who is asking.
 *
 * The rows are the same sample records the dashboard charts. Every file keeps
 * the sample-data header that the dashboard's own exports carry, so a
 * spreadsheet that leaves the platform still says what it is.
 */

type Row = (string | number)[];

interface Place {
  name: string;
  zone?: string;
  st?: number;
}

const FIELDS = schoolsFile.fields as string[];
const ROWS = schoolsFile.schools as (string | number)[][];
const STATES = places.states as Place[];
const LGAS = places.lgas as Place[];

const index = (field: string) => FIELDS.indexOf(field);
const COL = Object.fromEntries(FIELDS.map((f) => [f, index(f)])) as Record<string, number>;

const stateName = (i: number) => STATES[i]?.name ?? 'Unknown';
const stateZone = (i: number) => STATES[i]?.zone ?? 'Unknown';
const lgaName = (i: number) => LGAS[i]?.name ?? 'Unknown';

/** Expands a bitmask into the labels it stands for. */
function bitsToLabels(bits: number, labels: readonly string[]): string {
  return labels.filter((_, i) => (bits >> i) & 1).join('; ');
}

function schoolsByState(): { headers: string[]; rows: Row[] } {
  const headers = [
    'School ID', 'Name', 'State', 'Zone', 'LGA', 'Latitude', 'Longitude',
    'Type', 'Ownership', 'Status', 'Chigari supported',
    'Boys', 'Girls', 'Total enrolled', 'Under 6', 'Aged 6-11', 'Aged 12-17',
    'Mallams', 'Pupils per Mallam',
    'Infrastructure & WASH', 'Curriculum integration', 'Health & protection',
    'Immunised (%)', 'Street-begging (%)', 'Rating', 'Ratings',
  ];
  const rows = ROWS.map((r) => {
    const boys = Number(r[COL.boys]);
    const girls = Number(r[COL.girls]);
    const mallams = Number(r[COL.mallams]);
    return [
      `TSG-${r[COL.id]}`,
      String(r[COL.name]),
      stateName(Number(r[COL.st])),
      stateZone(Number(r[COL.st])),
      lgaName(Number(r[COL.lga])),
      Number(r[COL.lat]),
      Number(r[COL.lon]),
      catalog.types[Number(r[COL.type])] ?? '',
      catalog.own[Number(r[COL.own])] ?? '',
      Number(r[COL.active]) ? 'Operating' : 'Not operating',
      Number(r[COL.chig]) ? 'Yes' : 'No',
      boys, girls, boys + girls,
      Number(r[COL.a1]), Number(r[COL.a2]), Number(r[COL.a3]),
      mallams,
      mallams > 0 ? Math.round((boys + girls) / mallams) : 0,
      bitsToLabels(Number(r[COL.infra]), INFRASTRUCTURE),
      bitsToLabels(Number(r[COL.integ]), CURRICULUM),
      bitsToLabels(Number(r[COL.health]), HEALTH),
      Number(r[COL.imm]), Number(r[COL.beg]),
      Number(r[COL.rating]), Number(r[COL.nrat]),
    ] satisfies Row;
  });
  return { headers, rows };
}

/** One row per state and LGA, with enrolment split by age band. */
function learnerStatistics(): { headers: string[]; rows: Row[] } {
  const groups = new Map<string, { state: string; lga: string; schools: number; boys: number; girls: number; a1: number; a2: number; a3: number; mallams: number }>();
  for (const r of ROWS) {
    const key = `${r[COL.st]}:${r[COL.lga]}`;
    const group = groups.get(key) ?? {
      state: stateName(Number(r[COL.st])), lga: lgaName(Number(r[COL.lga])),
      schools: 0, boys: 0, girls: 0, a1: 0, a2: 0, a3: 0, mallams: 0,
    };
    group.schools += 1;
    group.boys += Number(r[COL.boys]);
    group.girls += Number(r[COL.girls]);
    group.a1 += Number(r[COL.a1]);
    group.a2 += Number(r[COL.a2]);
    group.a3 += Number(r[COL.a3]);
    group.mallams += Number(r[COL.mallams]);
    groups.set(key, group);
  }
  const headers = ['State', 'LGA', 'Schools', 'Boys', 'Girls', 'Total enrolled', 'Under 6', 'Aged 6-11', 'Aged 12-17', 'Mallams', 'Pupils per Mallam'];
  const rows = [...groups.values()]
    .sort((a, b) => a.state.localeCompare(b.state) || a.lga.localeCompare(b.lga))
    .map((g) => [
      g.state, g.lga, g.schools, g.boys, g.girls, g.boys + g.girls,
      g.a1, g.a2, g.a3, g.mallams,
      g.mallams > 0 ? Math.round((g.boys + g.girls) / g.mallams) : 0,
    ] satisfies Row);
  return { headers, rows };
}

/** The share of schools in each state having each facility. */
function infrastructureIndicators(): { headers: string[]; rows: Row[] } {
  const counts = new Map<string, { total: number; infra: number[]; health: number[] }>();
  for (const r of ROWS) {
    const state = stateName(Number(r[COL.st]));
    const entry = counts.get(state) ?? {
      total: 0,
      infra: INFRASTRUCTURE.map(() => 0),
      health: HEALTH.map(() => 0),
    };
    entry.total += 1;
    INFRASTRUCTURE.forEach((_, i) => { if ((Number(r[COL.infra]) >> i) & 1) entry.infra[i] += 1; });
    HEALTH.forEach((_, i) => { if ((Number(r[COL.health]) >> i) & 1) entry.health[i] += 1; });
    counts.set(state, entry);
  }
  const headers = [
    'State', 'Schools',
    ...INFRASTRUCTURE.map((l) => `${l} (%)`),
    ...HEALTH.map((l) => `${l} (%)`),
  ];
  const share = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);
  const rows = [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([state, e]) => [
      state, e.total,
      ...e.infra.map((n) => share(n, e.total)),
      ...e.health.map((n) => share(n, e.total)),
    ] satisfies Row);
  return { headers, rows };
}

/** School and learner counts per state: the figures behind the overview. */
function stateSummary(): { headers: string[]; rows: Row[] } {
  const totals = new Map<string, { zone: string; schools: number; pupils: number; mallams: number; supported: number }>();
  for (const r of ROWS) {
    const state = stateName(Number(r[COL.st]));
    const entry = totals.get(state) ?? { zone: stateZone(Number(r[COL.st])), schools: 0, pupils: 0, mallams: 0, supported: 0 };
    entry.schools += 1;
    entry.pupils += Number(r[COL.boys]) + Number(r[COL.girls]);
    entry.mallams += Number(r[COL.mallams]);
    entry.supported += Number(r[COL.chig]) ? 1 : 0;
    totals.set(state, entry);
  }
  const headers = ['State', 'Zone', 'Schools', 'Pupils enrolled', 'Mallams', 'Chigari supported schools'];
  const rows = [...totals.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([state, e]) => [state, e.zone, e.schools, e.pupils, e.mallams, e.supported] satisfies Row);
  return { headers, rows };
}

const BUILDERS: Record<string, () => { headers: string[]; rows: Row[] }> = {
  'schools-by-state': schoolsByState,
  'learner-statistics': learnerStatistics,
  'infrastructure-indicators': infrastructureIndicators,
  'state-summary': stateSummary,
};

function toCsv(headers: string[], rows: Row[]): string {
  const cell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  return [
    '# SAMPLE DATA - concept prototype, Chigari Almajiri Education Platform',
    headers.join(','),
    ...rows.map((row) => row.map(cell).join(',')),
  ].join('\n');
}

export interface RenderedDataset {
  filename: string;
  contentType: string;
  body: string;
  rowCount: number;
}

/** Builds a dataset in the requested format, or null if it has no builder. */
export function renderDataset(dataset: Dataset, format: string): RenderedDataset | null {
  const build = BUILDERS[dataset.id];
  if (!build) return null;
  const { headers, rows } = build();
  const stem = `chigari_${dataset.id}`;

  if (format.toUpperCase() === 'JSON') {
    const objects = rows.map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i]])));
    return {
      filename: `${stem}.json`,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ note: 'SAMPLE DATA - concept prototype', dataset: dataset.name, rows: objects }, null, 2),
      rowCount: rows.length,
    };
  }

  return {
    filename: `${stem}.csv`,
    contentType: 'text/csv; charset=utf-8',
    body: toCsv(headers, rows),
    rowCount: rows.length,
  };
}
