import type { ChartConfiguration } from 'chart.js';
import {
  AGE_BAND_LABELS,
  HEALTH,
  INFRASTRUCTURE,
  TREND_END_QUARTER,
  TREND_END_YEAR,
  TREND_START_YEAR,
} from '@/data/indicators';
import type {
  Aggregates,
  DashboardState,
  LgaProperties,
  SchoolRecord,
  StateProperties,
} from '@/data/types';
import { countBy, pupilsPerMallamByArea } from './aggregations';
import { cssVar, fmt, pct } from './formatting';
import { typeColor } from './map';

export interface ChartTable {
  headers: string[];
  rows: (string | number)[][];
}

export interface ChartSpec {
  id: string;
  title: string;
  desc: string;
  /** Spans both columns of the chart grid. */
  full?: boolean;
  /** Swatch legend drawn above the canvas, where one helps. */
  legend?: { colour: string; label: string }[];
  config: ChartConfiguration;
  table: ChartTable;
}

/** Shared axis, grid and tooltip styling, read from the active theme. */
function baseOptions(unit = ''): ChartConfiguration['options'] {
  const ink = cssVar('--text-secondary');
  const grid = cssVar('--grid-line');
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: cssVar('--surface-2'),
        titleColor: cssVar('--text-primary'),
        bodyColor: cssVar('--text-secondary'),
        borderColor: cssVar('--border'),
        borderWidth: 1,
        padding: 10,
        displayColors: true,
        boxPadding: 4,
      },
    },
    scales: {
      x: {
        ticks: { color: ink, font: { size: 11 } },
        grid: { display: false },
        border: { color: grid },
      },
      y: {
        ticks: {
          color: ink,
          font: { size: 11 },
          callback: (v) => fmt(Number(v)) + unit,
        },
        grid: { color: grid },
        border: { display: false },
        beginAtZero: true,
      },
    },
  };
}

/** A horizontal percentage bar chart, used by the indicator charts. */
function percentBars(labels: string[], data: number[]): ChartConfiguration {
  const accent = cssVar('--series-1');
  const options = baseOptions() as NonNullable<ChartConfiguration['options']>;
  return {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: accent,
          borderRadius: {
            topLeft: 0,
            topRight: 4,
            bottomLeft: 0,
            bottomRight: 4,
          },
          borderSkipped: 'start',
          barPercentage: 0.7,
          categoryPercentage: 0.9,
          borderColor: cssVar('--surface-1'),
          borderWidth: { top: 2, bottom: 2, left: 0, right: 0 },
        },
      ],
    },
    options: {
      ...options,
      indexAxis: 'y',
      plugins: {
        ...options.plugins,
        tooltip: {
          ...options.plugins?.tooltip,
          // On a horizontal bar the value is on the x axis. The prototype's
          // shared tooltip read `parsed.y`, which on these charts is the
          // category index, so every bar reported "0%" rather than its value.
          callbacks: { label: (c) => ` ${c.parsed.x}%` },
        },
      },
      scales: {
        x: {
          max: 100,
          ticks: {
            color: cssVar('--text-secondary'),
            callback: (v) => `${v}%`,
          },
          grid: { color: cssVar('--grid-line') },
          border: { display: false },
          beginAtZero: true,
        },
        y: {
          ticks: { color: cssVar('--text-secondary'), font: { size: 11 } },
          grid: { display: false },
          border: { display: false },
        },
      },
    },
  };
}

interface BuildContext {
  state: DashboardState;
  list: SchoolRecord[];
  aggregates: Aggregates;
  states: StateProperties[];
  lgas: LgaProperties[];
  types: string[];
  zone: string;
}

/** Quarters covered by the illustrative integration trend. */
function trendQuarters(): [number, number][] {
  const quarters: [number, number][] = [];
  for (let year = TREND_START_YEAR; year <= TREND_END_YEAR; year++) {
    for (let quarter = 1; quarter <= 4; quarter++) {
      if (year === TREND_END_YEAR && quarter > TREND_END_QUARTER) break;
      quarters.push([year, quarter]);
    }
  }
  return quarters;
}

/**
 * Builds every chart on the Programme overview.
 *
 * The descriptions are the prototype's wording, including the double asterisk
 * on the integration trend and the "lower is better" note on pupils per
 * Mallam. Both say something true about how the figure should be read, so
 * neither is cosmetic.
 */
export function buildCharts(context: BuildContext): ChartSpec[] {
  const { state, list, aggregates: a, states, lgas, types } = context;
  const national = state.st === '';
  const accent = cssVar('--series-1');
  const secondary = cssVar('--series-2');

  /* 1. Schools per area. */
  const areaCounts = countBy(list, national ? 'stateName' : 'lgaName');
  let areaRows: [string, number][];
  if (national) {
    areaRows = states
      .filter((s) => !state.zone || s.zone === state.zone)
      .map((s) => s.name)
      .sort()
      .map((name) => [name, areaCounts.get(name) ?? 0]);
  } else {
    const stateName = states[Number(state.st)]?.name;
    areaRows = lgas
      .filter((l) => l.state === stateName)
      .map((l) => l.name)
      .sort()
      .map((name) => [name, areaCounts.get(name) ?? 0]);
    if (state.lga !== '') {
      const selected = lgas[Number(state.lga)]?.name;
      areaRows = areaRows.filter(([name]) => name === selected);
    }
  }

  const areaOptions = baseOptions() as NonNullable<ChartConfiguration['options']>;
  const byArea: ChartSpec = {
    id: 'byArea',
    full: true,
    title: national ? 'Number of schools (state)' : 'Number of schools (LGA)',
    desc: 'Bar height is the count of schools matching the current filters.',
    config: {
      type: 'bar',
      data: {
        labels: areaRows.map((r) => r[0]),
        datasets: [
          {
            label: 'Schools',
            data: areaRows.map((r) => r[1]),
            backgroundColor: accent,
            borderRadius: {
              topLeft: 4,
              topRight: 4,
              bottomLeft: 0,
              bottomRight: 0,
            },
            borderSkipped: 'start',
            borderColor: cssVar('--surface-1'),
            borderWidth: { left: 1, right: 1, top: 0, bottom: 0 },
          },
        ],
      },
      options: {
        ...areaOptions,
        scales: {
          x: {
            ticks: {
              color: cssVar('--text-secondary'),
              font: { size: 10 },
              maxRotation: 90,
              minRotation: 60,
              autoSkip: false,
            },
            grid: { display: false },
          },
          y: {
            ticks: {
              color: cssVar('--text-secondary'),
              callback: (v) => fmt(Number(v)),
            },
            grid: { color: cssVar('--grid-line') },
            border: { display: false },
            beginAtZero: true,
          },
        },
      },
    },
    table: { headers: [national ? 'State' : 'LGA', 'Schools'], rows: areaRows },
  };

  /* 2. School type. */
  const typeColours = [0, 1, 2, 3].map(typeColor);
  // Typed as a doughnut on the way in, because `cutout` belongs to that chart
  // type and not to the union `ChartSpec.config` is declared as.
  const typesConfig: ChartConfiguration<'doughnut'> = {
    type: 'doughnut',
    data: {
      labels: types,
      datasets: [
        {
          data: a.types,
          backgroundColor: typeColours,
          borderColor: cssVar('--surface-1'),
          borderWidth: 2,
          borderRadius: 4,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: cssVar('--surface-2'),
          titleColor: cssVar('--text-primary'),
          bodyColor: cssVar('--text-secondary'),
          borderColor: cssVar('--border'),
          borderWidth: 1,
          padding: 10,
          boxPadding: 4,
          callbacks: {
            label: (c) => ` ${c.label}: ${fmt(Number(c.parsed))} (${pct(Number(c.parsed), a.n)}%)`,
          },
        },
      },
    },
  };

  const typesChart: ChartSpec = {
    id: 'types',
    title: 'School type',
    desc: 'Share of schools by type.',
    legend: types.map((t, i) => ({
      colour: typeColours[i],
      label: `${t} (${pct(a.types[i], a.n)}%)`,
    })),
    config: typesConfig as ChartConfiguration,
    table: {
      headers: ['School type', 'Schools'],
      rows: types.map((t, i) => [t, a.types[i]]),
    },
  };

  /* 3. Pupils by age group. */
  const ageRows: [string, number][] = [
    [AGE_BAND_LABELS[0], a.a1],
    [AGE_BAND_LABELS[1], a.a2],
    [AGE_BAND_LABELS[2], a.a3],
  ];
  const age: ChartSpec = {
    id: 'age',
    title: 'Enrolled pupils by age group',
    desc: 'Total pupils in the filtered schools.',
    legend: [
      {
        colour: 'transparent',
        label: `Boys ${fmt(a.boys)} (${pct(a.boys, a.pupils)}%)`,
      },
      {
        colour: 'transparent',
        label: `Girls ${fmt(a.girls)} (${pct(a.girls, a.pupils)}%)`,
      },
    ],
    config: {
      type: 'bar',
      data: {
        labels: ageRows.map((r) => r[0]),
        datasets: [
          {
            label: 'Pupils',
            data: ageRows.map((r) => r[1]),
            backgroundColor: accent,
            borderRadius: {
              topLeft: 4,
              topRight: 4,
              bottomLeft: 0,
              bottomRight: 0,
            },
            borderSkipped: 'start',
            barPercentage: 0.5,
          },
        ],
      },
      options: baseOptions(),
    },
    table: { headers: ['Age group', 'Pupils'], rows: ageRows },
  };

  /* 4. Curriculum integration trend (illustrative). */
  const quarters = trendQuarters();
  const integrated = list.filter((s) => s.integrated);
  const supported = integrated.filter((s) => s.chig);
  // A school with no recorded integration year is treated as integrated
  // before the window opens; within its year, its id spreads it across the
  // four quarters. This is the prototype's illustrative shaping, not a
  // measurement, which is what the double asterisk on the title marks.
  const upTo = (arr: SchoolRecord[], year: number, quarter: number) =>
    arr.filter(
      (s) =>
        !s.integYear || s.integYear < year || (s.integYear === year && (s.id % 4) + 1 <= quarter),
    ).length;
  const cumulative = quarters.map(([y, q]) => upTo(integrated, y, q));
  const supportedCumulative = quarters.map(([y, q], i) =>
    Math.min(upTo(supported, y, q), cumulative[i]),
  );
  const trendOptions = baseOptions() as NonNullable<ChartConfiguration['options']>;
  const trend: ChartSpec = {
    id: 'trend',
    title: 'Curriculum integration trend **',
    desc: '** Illustrative: cumulative number of Tsangaya schools teaching basic literacy/numeracy.',
    legend: [
      { colour: accent, label: 'All integrated schools' },
      { colour: secondary, label: 'Of which Chigari-supported' },
    ],
    config: {
      type: 'line',
      data: {
        labels: quarters.map(([y, q]) => `${y} Q${q}`),
        datasets: [
          {
            label: 'Integrated schools',
            data: cumulative,
            borderColor: accent,
            backgroundColor: accent,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            tension: 0.25,
          },
          {
            label: 'Chigari-supported',
            data: supportedCumulative,
            borderColor: secondary,
            backgroundColor: secondary,
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 5,
            tension: 0.25,
          },
        ],
      },
      options: {
        ...trendOptions,
        interaction: { mode: 'index', intersect: false },
      },
    },
    table: {
      headers: ['Quarter', 'Integrated schools', 'Chigari-supported'],
      rows: quarters.map(([y, q], i) => [`${y} Q${q}`, cumulative[i], supportedCumulative[i]]),
    },
  };

  /* 5. Infrastructure & WASH. */
  const infraRows: [string, number][] = INFRASTRUCTURE.map((name, i) => [
    name,
    pct(a.infra[i], a.n),
  ]);
  const infra: ChartSpec = {
    id: 'infra',
    title: 'Infrastructure & WASH',
    desc: 'Percent of filtered schools with each facility.',
    config: percentBars(
      infraRows.map((r) => r[0]),
      infraRows.map((r) => r[1]),
    ),
    table: { headers: ['Facility', '% of schools'], rows: infraRows },
  };

  /* 6. Health & protection. */
  const healthRows: [string, number][] = [
    ...HEALTH.map((name, i) => [name, pct(a.health[i], a.n)] as [string, number]),
    ['Pupils fully immunised (avg)', a.immAvg],
    ['Pupils seen street-begging (avg)', a.begAvg],
  ];
  const health: ChartSpec = {
    id: 'health',
    title: 'Health & protection',
    desc: 'Percent of filtered schools meeting each indicator.',
    config: percentBars(
      healthRows.map((r) => r[0]),
      healthRows.map((r) => r[1]),
    ),
    table: { headers: ['Indicator', '%'], rows: healthRows },
  };

  /* 7. Pupils per Mallam. */
  const ratioRows = pupilsPerMallamByArea(list, national ? 'stateName' : 'lgaName', 15);
  const ratioConfig = percentBars(
    ratioRows.map((r) => r[0]),
    ratioRows.map((r) => r[1]),
  );
  const ratioScales = ratioConfig.options?.scales as Record<string, Record<string, unknown>>;
  // This one is a count, not a percentage, so the axis cap and the percent
  // suffix that the indicator charts use have to come back off.
  delete ratioScales.x.max;
  ratioScales.x.ticks = {
    color: cssVar('--text-secondary'),
    callback: (v: unknown) => `${v}`,
  };
  const ratioPlugins = ratioConfig.options?.plugins as Record<string, Record<string, unknown>>;
  ratioPlugins.tooltip.callbacks = {
    label: (c: { parsed: { x: number } }) => ` ${c.parsed.x} pupils per Mallam`,
  };
  const ratio: ChartSpec = {
    id: 'ratio',
    title: national ? 'Pupils per Mallam (state)' : 'Pupils per Mallam (LGA)',
    desc: 'Lower is better. Top 15 areas with the highest ratio.',
    config: ratioConfig,
    table: {
      headers: [national ? 'State' : 'LGA', 'Pupils per Mallam'],
      rows: ratioRows,
    },
  };

  return [byArea, typesChart, age, trend, infra, health, ratio];
}

/** The eight headline tiles above the charts. */
export function buildTiles(a: Aggregates): { value: string; label: string; tip: string }[] {
  return [
    {
      value: fmt(a.n),
      label: 'Almajiri / Tsangaya schools',
      tip: 'Schools matching the current filters.',
    },
    {
      value: fmt(a.pupils),
      label: 'Enrolled pupils',
      tip: `Boys ${fmt(a.boys)} · Girls ${fmt(a.girls)}`,
    },
    {
      value: fmt(a.integ),
      label: 'Integrated schools',
      tip: 'Schools teaching at least one basic-education subject alongside Qur’anic studies.',
    },
    {
      value: fmt(a.chig),
      label: 'Chigari-supported schools',
      tip: 'Schools receiving Chigari Foundation programme support (sample).',
    },
    {
      value: fmt(a.mallams),
      label: 'Mallams (teachers)',
      tip: `About ${a.ratio} pupils per Mallam.`,
    },
    {
      value: `${a.immAvg}%`,
      label: 'Pupils fully immunised',
      tip: 'Pupil-weighted average of reported immunisation coverage (sample).',
    },
    {
      value: `${pct(a.infra[2], a.n)}%`,
      label: 'Schools with safe water',
      tip: 'Share of schools with a safe drinking-water source.',
    },
    {
      value: `${a.begAvg}%`,
      label: 'Pupils seen street-begging',
      tip: 'Estimated share of pupils observed begging during visits (sample). Lower is better.',
    },
  ];
}
