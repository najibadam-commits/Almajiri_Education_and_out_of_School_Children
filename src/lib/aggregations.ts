import { CURRICULUM, HEALTH, INFRASTRUCTURE } from '@/data/indicators';
import type { Aggregates, SchoolRecord } from '@/data/types';

/**
 * Derives every KPI the dashboard shows from a list of schools.
 *
 * Nothing here is hard-coded: each view calls this with its own filtered list,
 * so the KPIs always describe exactly what the user is currently looking at.
 *
 * The two rate indicators are pupil-weighted, not school-weighted: a school of
 * 400 pupils moves the national immunisation average more than one of 40.
 */
export function aggregate(list: SchoolRecord[]): Aggregates {
  const a: Aggregates = {
    n: list.length,
    pupils: 0,
    boys: 0,
    girls: 0,
    a1: 0,
    a2: 0,
    a3: 0,
    mallams: 0,
    integ: 0,
    chig: 0,
    active: 0,
    infra: new Array(INFRASTRUCTURE.length).fill(0),
    curr: new Array(CURRICULUM.length).fill(0),
    health: new Array(HEALTH.length).fill(0),
    types: [0, 0, 0, 0],
    own: [0, 0, 0, 0],
    imm: 0,
    beg: 0,
    immAvg: 0,
    begAvg: 0,
    ratio: 0,
  };

  for (const s of list) {
    a.pupils += s.pupils;
    a.boys += s.boys;
    a.girls += s.girls;
    a.a1 += s.a1;
    a.a2 += s.a2;
    a.a3 += s.a3;
    a.mallams += s.mallams;
    if (s.integrated) a.integ++;
    if (s.chig) a.chig++;
    if (s.active) a.active++;
    for (let b = 0; b < INFRASTRUCTURE.length; b++) if (s.infra & (1 << b)) a.infra[b]++;
    for (let b = 0; b < CURRICULUM.length; b++) if (s.integ & (1 << b)) a.curr[b]++;
    for (let b = 0; b < HEALTH.length; b++) if (s.health & (1 << b)) a.health[b]++;
    a.types[s.type]++;
    a.own[s.own]++;
    a.imm += s.imm * s.pupils;
    a.beg += s.beg * s.pupils;
  }

  a.immAvg = a.pupils ? Math.round(a.imm / a.pupils) : 0;
  a.begAvg = a.pupils ? Math.round(a.beg / a.pupils) : 0;
  a.ratio = a.mallams ? Math.round(a.pupils / a.mallams) : 0;
  return a;
}

/** Counts schools by a named key, for the overview and chart bar lists. */
export function countBy(list: SchoolRecord[], key: 'stateName' | 'lgaName'): Map<string, number> {
  const by = new Map<string, number>();
  for (const s of list) by.set(s[key], (by.get(s[key]) ?? 0) + 1);
  return by;
}

/** Groups schools by their state or LGA index, for map choropleths. */
export function groupByArea(list: SchoolRecord[], key: 'st' | 'lga'): Map<number, SchoolRecord[]> {
  const by = new Map<number, SchoolRecord[]>();
  for (const s of list) {
    const bucket = by.get(s[key]);
    if (bucket) bucket.push(s);
    else by.set(s[key], [s]);
  }
  return by;
}

/** Pupils per Mallam per area, highest first. */
export function pupilsPerMallamByArea(
  list: SchoolRecord[],
  key: 'stateName' | 'lgaName',
  limit: number,
): [string, number][] {
  const g = new Map<string, [number, number]>();
  for (const s of list) {
    const cur = g.get(s[key]) ?? [0, 0];
    cur[0] += s.pupils;
    cur[1] += s.mallams;
    g.set(s[key], cur);
  }
  return [...g.entries()]
    .map(([n, [p, m]]) => [n, m ? Math.round(p / m) : 0] as [string, number])
    .sort((x, y) => y[1] - x[1])
    .slice(0, limit);
}
