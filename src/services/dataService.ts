import type {
  Aggregates,
  Basemap,
  Boundaries,
  Catalog,
  DashboardState,
  FilterGroup,
  LgaProperties,
  SchoolRecord,
  StateProperties,
} from '@/data/types';
import { aggregate } from '@/lib/aggregations';
import { filterSchools, type FilterOptions } from '@/lib/filters';

/**
 * The seam between the UI and wherever the data actually lives.
 *
 * Every view consumes these functions and none of them knows that today the
 * answers come from bundled sample JSON. When a real API is connected, only
 * this module's implementation changes.
 */
export interface DataService {
  /** School type, ownership and zone labels. */
  getCatalog(): Promise<Catalog>;
  /** All schools, enriched with their place names and derived fields. */
  getSchools(): Promise<SchoolRecord[]>;
  getSchoolById(id: number): Promise<SchoolRecord | undefined>;
  /** State names and zones, in dataset order. Indexes are ids. */
  getStates(): Promise<StateProperties[]>;
  /** LGA names and parent states, in dataset order. Indexes are ids. */
  getLGAs(): Promise<LgaProperties[]>;
  /** State and LGA geometry. Loaded on demand: it is the largest payload. */
  getBoundaries(): Promise<Boundaries>;
  /** Offline basemap context. Loaded on demand. */
  getBasemap(): Promise<Basemap>;
  /** KPIs for the schools matching the current filters. */
  getDashboardAggregates(
    state: DashboardState,
    groups: FilterGroup[],
    options?: FilterOptions,
  ): Promise<Aggregates>;
}

/** Where the sample payloads are served from. */
const DATA_ROOT = '/data';

/** In-flight and settled payloads, so each file is fetched at most once. */
const cache = new Map<string, Promise<unknown>>();

function loadJson<T>(file: string): Promise<T> {
  let hit = cache.get(file);
  if (!hit) {
    hit = fetch(`${DATA_ROOT}/${file}`).then(async (res) => {
      if (!res.ok) {
        throw new Error(`Could not load ${file} (${res.status} ${res.statusText})`);
      }
      return res.json();
    });
    // A failed load must not be cached, or the dashboard can never recover.
    hit.catch(() => cache.delete(file));
    cache.set(file, hit);
  }
  return hit as Promise<T>;
}

/** The dataset's compact on-disk encoding: a field list plus tuples. */
interface SchoolPayload {
  fields: string[];
  schools: (number | string)[][];
}

interface PlacesPayload {
  states: StateProperties[];
  lgas: LgaProperties[];
}

/**
 * Expands a tuple-encoded record and derives the fields the dashboard reads.
 * Keeping the wire format as tuples rather than objects is what holds the
 * school payload to well under a megabyte.
 */
function expand(fields: string[], row: (number | string)[], places: PlacesPayload): SchoolRecord {
  const o = {} as Record<string, number | string>;
  fields.forEach((k, i) => {
    o[k] = row[i];
  });
  const rec = o as unknown as SchoolRecord;
  const stateProps = places.states[rec.st];
  rec.stateName = stateProps.name;
  rec.zone = stateProps.zone;
  rec.lgaName = places.lgas[rec.lga].name;
  rec.pupils = rec.boys + rec.girls;
  rec.integrated = rec.integ !== 0;
  rec.search = `${rec.name} ${rec.lgaName} ${rec.stateName}`.toLowerCase();
  return rec;
}

let schoolsPromise: Promise<SchoolRecord[]> | null = null;
let schoolIndex: Map<number, SchoolRecord> | null = null;

/**
 * Reads the bundled sample dataset.
 *
 * SAMPLE DATA ONLY. Every record, count, rating and trend it returns is
 * randomly generated for demonstration and is not Chigari Foundation or
 * government data.
 */
export const sampleDataService: DataService = {
  getCatalog: () => loadJson<Catalog>('catalog.json'),

  getSchools() {
    if (!schoolsPromise) {
      schoolsPromise = Promise.all([
        loadJson<SchoolPayload>('schools.json'),
        loadJson<PlacesPayload>('places.json'),
      ]).then(([payload, places]) => {
        const list = payload.schools.map((row) => expand(payload.fields, row, places));
        schoolIndex = new Map(list.map((s) => [s.id, s]));
        return list;
      });
      schoolsPromise.catch(() => {
        schoolsPromise = null;
      });
    }
    return schoolsPromise;
  },

  async getSchoolById(id: number) {
    await this.getSchools();
    return schoolIndex?.get(id);
  },

  async getStates() {
    return (await loadJson<PlacesPayload>('places.json')).states;
  },

  async getLGAs() {
    return (await loadJson<PlacesPayload>('places.json')).lgas;
  },

  async getBoundaries() {
    const [states, lgas] = await Promise.all([
      loadJson<Boundaries['states']>('states.geojson'),
      loadJson<Boundaries['lgas']>('lgas.geojson'),
    ]);
    return { states, lgas };
  },

  getBasemap: () => loadJson<Basemap>('basemap.json'),

  async getDashboardAggregates(state, groups, options) {
    const schools = await this.getSchools();
    return aggregate(filterSchools(schools, state, groups, options));
  },
};

/**
 * The service the application uses. Swap this binding to point the dashboard
 * at a real API; no view imports a data file directly.
 */
export const dataService: DataService = sampleDataService;
