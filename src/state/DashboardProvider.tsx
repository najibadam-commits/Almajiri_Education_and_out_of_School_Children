'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { buildFilterGroups } from '@/data/indicators';
import type {
  Aggregates,
  Catalog,
  DashboardState,
  FilterGroup,
  FilterGroupKey,
  LgaProperties,
  MapLayers,
  SchoolRecord,
  SortKey,
  StateProperties,
  Theme,
  ViewKey,
} from '@/data/types';
import { aggregate } from '@/lib/aggregations';
import { filterSchools, scopeLabel, type FilterOptions } from '@/lib/filters';
import { dataService } from '@/services/dataService';
import { dashboardReducer, initialDashboardState, initialMapLayers } from './dashboardReducer';

type LoadStatus = 'loading' | 'ready' | 'error';

export interface FocusOptions {
  /**
   * Goes to the map even from the grid, where picking a school would
   * otherwise open its profile. Set by the profile's own "Show on map".
   */
  forceMap?: boolean;
}

/** A request for the map to centre on one school and open its popup. */
export interface FocusRequest {
  school: SchoolRecord;
  /** Increments on every request, so repeating the same school still fires. */
  token: number;
}

interface DashboardContextValue {
  status: LoadStatus;
  error: string | null;
  /** Retries the initial data load after a failure. */
  retry: () => void;

  schools: SchoolRecord[];
  catalog: Catalog;
  states: StateProperties[];
  lgas: LgaProperties[];
  groups: FilterGroup[];

  state: DashboardState;
  /** Schools matching the current filters. */
  filtered: SchoolRecord[];
  /** KPIs derived from `filtered`. */
  aggregates: Aggregates;
  /** Human-readable description of the current geographic scope. */
  scope: string;
  /** Applies the current filters with per-call overrides, for the map. */
  filterWith: (options?: FilterOptions) => SchoolRecord[];

  layers: MapLayers;
  setLayers: (patch: Partial<MapLayers>) => void;
  theme: Theme;
  toggleTheme: () => void;

  /** Increments when a location change should refit the map. */
  fitToken: number;
  focusRequest: FocusRequest | null;

  profileSchool: SchoolRecord | null;
  feedbackSchool: SchoolRecord | null;
  toast: string | null;

  setView: (view: ViewKey) => void;
  setZone: (zone: string) => void;
  setStateFilter: (st: string) => void;
  setLgaFilter: (lga: string) => void;
  setQuery: (q: string) => void;
  setCheck: (key: FilterGroupKey, value: number, on: boolean) => void;
  setSort: (sort: SortKey) => void;
  loadMore: () => void;
  reset: () => void;

  /** Centres the map on a school, switching to the map view if needed. */
  focusSchool: (school: SchoolRecord, options?: FocusOptions) => void;
  openProfile: (school: SchoolRecord | null) => void;
  openFeedback: (school: SchoolRecord | null) => void;
  showToast: (message: string) => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

const EMPTY_CATALOG: Catalog = { types: [], own: [], zones: [] };

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [catalog, setCatalog] = useState<Catalog>(EMPTY_CATALOG);
  const [states, setStates] = useState<StateProperties[]>([]);
  const [lgas, setLgas] = useState<LgaProperties[]>([]);

  const [state, dispatch] = useReducer(dashboardReducer, initialDashboardState);
  const [layers, setLayersState] = useState<MapLayers>(initialMapLayers);
  const [theme, setTheme] = useState<Theme>('dark');

  const [fitToken, setFitToken] = useState(0);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [profileSchool, setProfileSchool] = useState<SchoolRecord | null>(null);
  const [feedbackSchool, setFeedbackSchool] = useState<SchoolRecord | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusToken = useRef(0);
  const hydrated = useRef(false);

  /* ---------- data ---------- */

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);

    Promise.all([
      dataService.getSchools(),
      dataService.getCatalog(),
      dataService.getStates(),
      dataService.getLGAs(),
    ])
      .then(([loadedSchools, loadedCatalog, loadedStates, loadedLgas]) => {
        if (cancelled) return;
        setSchools(loadedSchools);
        setCatalog(loadedCatalog);
        setStates(loadedStates);
        setLgas(loadedLgas);
        setStatus('ready');
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'The dataset could not be loaded.');
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const groups = useMemo(
    () => buildFilterGroups(catalog.types, catalog.own),
    [catalog.types, catalog.own],
  );

  /* ---------- theme ---------- */

  useEffect(() => {
    const saved = document.documentElement.dataset.theme;
    if (saved === 'light' || saved === 'dark') setTheme(saved);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem('cf-theme', next);
      } catch {
        /* Storage can be unavailable; the theme still applies for this visit. */
      }
      return next;
    });
  }, []);

  /* ---------- URL state ---------- */

  // Read the URL once the place names are known, so that a shared link such as
  // /dashboard?view=map&state=Kano&lga=Nassarawa restores its scope.
  useEffect(() => {
    if (hydrated.current || status !== 'ready') return;
    hydrated.current = true;

    const view = searchParams.get('view');
    const zone = searchParams.get('zone') ?? '';
    const stateName = searchParams.get('state');
    const lgaName = searchParams.get('lga');
    const q = searchParams.get('q') ?? '';
    const sort = searchParams.get('sort');

    const patch: Partial<DashboardState> = {};
    if (view === 'map' || view === 'chart' || view === 'grid') patch.view = view;
    if (zone && catalog.zones.includes(zone)) patch.zone = zone;
    if (stateName) {
      const index = states.findIndex((s) => s.name === stateName);
      if (index >= 0) {
        patch.st = String(index);
        patch.zone = '';
      }
    }
    if (lgaName && patch.st !== undefined) {
      const index = lgas.findIndex(
        (l) => l.name === lgaName && l.state === states[Number(patch.st)].name,
      );
      if (index >= 0) patch.lga = String(index);
    }
    if (q) patch.q = q;
    if (sort === 'visit' || sort === 'pupils' || sort === 'rating' || sort === 'name') {
      patch.sort = sort;
    }

    if (Object.keys(patch).length > 0) {
      dispatch({ type: 'hydrate', state: patch });
      if (patch.st !== undefined || patch.zone) setFitToken((n) => n + 1);
    }
  }, [status, searchParams, states, lgas, catalog.zones]);

  // Write the scope back to the URL so views can be bookmarked and shared, and
  // so browser back and forward move through them.
  useEffect(() => {
    if (!hydrated.current || status !== 'ready') return;

    const params = new URLSearchParams();
    if (state.view !== 'map') params.set('view', state.view);
    if (state.zone) params.set('zone', state.zone);
    if (state.st !== '') params.set('state', states[Number(state.st)].name);
    if (state.lga !== '') params.set('lga', lgas[Number(state.lga)].name);
    if (state.q.trim()) params.set('q', state.q.trim());
    if (state.sort !== 'visit') params.set('sort', state.sort);

    const query = params.toString();
    const next = query ? `${pathname}?${query}` : pathname;
    if (next !== `${pathname}${window.location.search}`) {
      router.replace(next, { scroll: false });
    }
  }, [
    status,
    state.view,
    state.zone,
    state.st,
    state.lga,
    state.q,
    state.sort,
    states,
    lgas,
    pathname,
    router,
  ]);

  /* ---------- derived ---------- */

  const filtered = useMemo(() => filterSchools(schools, state, groups), [schools, state, groups]);

  const aggregates = useMemo(() => aggregate(filtered), [filtered]);

  const scope = useMemo(
    () =>
      status === 'ready'
        ? scopeLabel(
            state,
            states.map((s) => s.name),
            lgas,
          )
        : '',
    [status, state, states, lgas],
  );

  const filterWith = useCallback(
    (options?: FilterOptions) => filterSchools(schools, state, groups, options),
    [schools, state, groups],
  );

  /* ---------- actions ---------- */

  const setView = useCallback((view: ViewKey) => dispatch({ type: 'setView', view }), []);

  const setZone = useCallback((zone: string) => {
    dispatch({ type: 'setZone', zone });
    setFitToken((n) => n + 1);
  }, []);

  const setStateFilter = useCallback(
    (st: string) => {
      const zoneOfState = st === '' ? null : (states[Number(st)]?.zone ?? null);
      dispatch({ type: 'setState', st, zoneOfState });
      setFitToken((n) => n + 1);
    },
    [states],
  );

  const setLgaFilter = useCallback(
    (lga: string) => {
      let stOfLga: string | null = null;
      if (lga !== '') {
        const parent = lgas[Number(lga)]?.state;
        const index = states.findIndex((s) => s.name === parent);
        stOfLga = index >= 0 ? String(index) : null;
      }
      dispatch({ type: 'setLga', lga, stOfLga });
      setFitToken((n) => n + 1);
    },
    [states, lgas],
  );

  const setQuery = useCallback((q: string) => dispatch({ type: 'setQuery', q }), []);

  const setCheck = useCallback(
    (key: FilterGroupKey, value: number, on: boolean) =>
      dispatch({ type: 'toggleCheck', key, value, on }),
    [],
  );

  const setSort = useCallback((sort: SortKey) => dispatch({ type: 'setSort', sort }), []);
  const loadMore = useCallback(() => dispatch({ type: 'nextPage' }), []);

  const reset = useCallback(() => {
    dispatch({ type: 'reset' });
    setFitToken((n) => n + 1);
  }, []);

  const setLayers = useCallback(
    (patch: Partial<MapLayers>) => setLayersState((current) => ({ ...current, ...patch })),
    [],
  );

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  /**
   * Drills the filters down to one school's LGA and asks the map to centre on
   * it. From the chart view this switches to the map first, as the prototype
   * does; from the grid it opens the school's profile instead.
   */
  const focusSchool = useCallback(
    (school: SchoolRecord, options?: FocusOptions) => {
      // From the grid, picking a school opens its record rather than moving a
      // map the user is not looking at. "Show on map" overrides that.
      const showProfileInstead = state.view === 'grid' && !options?.forceMap;
      if (!showProfileInstead) dispatch({ type: 'setView', view: 'map' });

      dispatch({
        type: 'hydrate',
        state: { zone: '', st: String(school.st), lga: String(school.lga) },
      });
      // No refit here: the map is positioned by the focus request itself, at
      // the school's own zoom, so a fly-to-bounds would only fight it.

      if (showProfileInstead) {
        setProfileSchool(school);
      } else {
        focusToken.current += 1;
        setFocusRequest({ school, token: focusToken.current });
      }
    },
    [state.view],
  );

  const openProfile = useCallback((school: SchoolRecord | null) => setProfileSchool(school), []);
  const openFeedback = useCallback((school: SchoolRecord | null) => setFeedbackSchool(school), []);

  const value: DashboardContextValue = {
    status,
    error,
    retry,
    schools,
    catalog,
    states,
    lgas,
    groups,
    state,
    filtered,
    aggregates,
    scope,
    filterWith,
    layers,
    setLayers,
    theme,
    toggleTheme,
    fitToken,
    focusRequest,
    profileSchool,
    feedbackSchool,
    toast,
    setView,
    setZone,
    setStateFilter,
    setLgaFilter,
    setQuery,
    setCheck,
    setSort,
    loadMore,
    reset,
    focusSchool,
    openProfile,
    openFeedback,
    showToast,
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard(): DashboardContextValue {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useDashboard must be used inside a DashboardProvider');
  return context;
}
