import { emptyChecks, toggleCheck } from '@/lib/filters';
import type { DashboardState, FilterGroupKey, MapLayers, SortKey, ViewKey } from '@/data/types';

export const initialDashboardState: DashboardState = {
  view: 'map',
  zone: '',
  st: '',
  lga: '',
  q: '',
  checks: emptyChecks(),
  sort: 'visit',
  page: 1,
};

export const initialMapLayers: MapLayers = {
  choropleth: true,
  badges: true,
  points: true,
  basemap: 'offline',
};

export type DashboardAction =
  | { type: 'setView'; view: ViewKey }
  | { type: 'setZone'; zone: string }
  | { type: 'setState'; st: string; zoneOfState: string | null }
  | { type: 'setLga'; lga: string; stOfLga: string | null }
  | { type: 'setQuery'; q: string }
  | { type: 'toggleCheck'; key: FilterGroupKey; value: number; on: boolean }
  | { type: 'setSort'; sort: SortKey }
  | { type: 'nextPage' }
  | { type: 'reset' }
  | { type: 'hydrate'; state: Partial<DashboardState> };

/**
 * The dashboard's single state transition.
 *
 * The location rules are the prototype's:
 * - choosing a zone clears the state and LGA below it;
 * - choosing a state clears the LGA, and clears the zone when the state sits
 *   in a different one;
 * - choosing an LGA pulls its state up with it;
 * - any change to the filtered set puts the grid back on its first page.
 */
export function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'setView':
      return state.view === action.view ? state : { ...state, view: action.view };

    case 'setZone':
      return { ...state, zone: action.zone, st: '', lga: '', page: 1 };

    case 'setState': {
      const st = action.st === '' ? '' : String(action.st);
      let zone = state.zone;
      if (st !== '' && action.zoneOfState && zone && zone !== action.zoneOfState) zone = '';
      return { ...state, st, lga: '', zone, page: 1 };
    }

    case 'setLga': {
      const lga = action.lga === '' ? '' : String(action.lga);
      const st = lga !== '' && action.stOfLga !== null ? action.stOfLga : state.st;
      return { ...state, lga, st, page: 1 };
    }

    case 'setQuery':
      return state.q === action.q ? state : { ...state, q: action.q, page: 1 };

    case 'toggleCheck':
      return {
        ...state,
        checks: toggleCheck(state.checks, action.key, action.value, action.on),
        page: 1,
      };

    case 'setSort':
      return { ...state, sort: action.sort, page: 1 };

    case 'nextPage':
      return { ...state, page: state.page + 1 };

    case 'reset':
      return { ...initialDashboardState, view: state.view, checks: emptyChecks() };

    case 'hydrate':
      return { ...state, ...action.state, page: 1 };

    default:
      return state;
  }
}
