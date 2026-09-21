import { FILTER_GROUP_KEYS } from '@/data/indicators';
import type {
  DashboardState,
  FilterChecks,
  FilterGroup,
  FilterGroupKey,
  SchoolRecord,
} from '@/data/types';

export interface FilterOptions {
  /**
   * Skips the state and LGA filters. The map uses this at national level so
   * that every state keeps its own count while a zone filter still applies.
   */
  ignoreState?: boolean;
}

/** An empty set of ticked indicator options. */
export function emptyChecks(): FilterChecks {
  return FILTER_GROUP_KEYS.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {} as FilterChecks);
}

/** True when no indicator option is ticked in any group. */
export function noChecks(checks: FilterChecks): boolean {
  return FILTER_GROUP_KEYS.every((key) => checks[key].length === 0);
}

/**
 * Applies the dashboard's filters to the full school list.
 *
 * The semantics are the prototype's and must not drift:
 * - zone, state, LGA and the search query each narrow the list;
 * - a `bits` group requires EVERY ticked option (bitwise AND);
 * - an `enum` group matches ANY ticked option.
 */
export function filterSchools(
  schools: SchoolRecord[],
  state: DashboardState,
  groups: FilterGroup[],
  options: FilterOptions = {},
): SchoolRecord[] {
  const q = state.q.trim().toLowerCase();
  const active = groups.filter((g) => state.checks[g.key].length > 0);

  return schools.filter((s) => {
    if (state.zone && s.zone !== state.zone) return false;
    if (!options.ignoreState && state.st !== '' && s.st !== Number(state.st)) return false;
    if (!options.ignoreState && state.lga !== '' && s.lga !== Number(state.lga)) return false;
    if (q && !s.search.includes(q)) return false;

    for (const g of active) {
      const picked = state.checks[g.key];
      if (g.mode === 'bits') {
        const field = s[g.key as 'infra' | 'integ' | 'health'];
        for (const bit of picked) {
          if (!(field & (1 << bit))) return false;
        }
      } else {
        const field = s[g.key as 'type' | 'own' | 'chig' | 'active'];
        if (!picked.includes(field)) return false;
      }
    }
    return true;
  });
}

/** Toggles one option in one group, returning a new checks object. */
export function toggleCheck(
  checks: FilterChecks,
  key: FilterGroupKey,
  value: number,
  on: boolean,
): FilterChecks {
  const current = checks[key];
  const next = on
    ? current.includes(value)
      ? current
      : [...current, value]
    : current.filter((v) => v !== value);
  return { ...checks, [key]: next };
}

/**
 * Describes the current geographic scope, as shown beside every view heading.
 */
export function scopeLabel(
  state: DashboardState,
  stateNames: string[],
  lgaNames: { name: string }[],
): string {
  if (state.lga !== '') {
    return `${lgaNames[Number(state.lga)].name} LGA, ${stateNames[Number(state.st)]} State`;
  }
  if (state.st !== '') return `${stateNames[Number(state.st)]} State`;
  if (state.zone) return `${state.zone} zone`;
  return 'Nigeria (all states)';
}
