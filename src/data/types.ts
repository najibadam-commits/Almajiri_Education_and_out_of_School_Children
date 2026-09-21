/**
 * Data model for the CHIGARI Almajiri Education Information System.
 *
 * The field names mirror the prototype's compact record encoding
 * (window.CF_DATA.fields) so that the sample dataset can be read without a
 * translation step, and so the meaning of each field stays traceable back to
 * the reference implementation.
 */

/** Index into {@link Catalog.types}. */
export type SchoolTypeIndex = 0 | 1 | 2 | 3;

/** Index into {@link Catalog.own}. */
export type OwnershipIndex = 0 | 1 | 2 | 3;

/**
 * Bit flags. Each indicator group is stored as a small integer whose bits map
 * positionally onto the label arrays in `indicators.ts`.
 */
export type IndicatorBits = number;

/** A school exactly as it is stored in the dataset, before enrichment. */
export interface RawSchoolRecord {
  /** Stable record id. Rendered as `TSG-<id>` in the profile. */
  id: number;
  name: string;
  /** Index into the state feature collection. */
  st: number;
  /** Index into the LGA feature collection. */
  lga: number;
  lat: number;
  lon: number;
  type: SchoolTypeIndex;
  own: OwnershipIndex;
  /** 1 when the school is operating. */
  active: 0 | 1;
  /** 1 when the school receives Chigari Foundation support. */
  chig: 0 | 1;
  boys: number;
  girls: number;
  /** Pupils under 6. */
  a1: number;
  /** Pupils aged 6-11. */
  a2: number;
  /** Pupils aged 12-17. */
  a3: number;
  mallams: number;
  /** Curriculum-integration subjects taught, as bits over `CURRICULUM`. */
  integ: IndicatorBits;
  /** Facilities present, as bits over `INFRASTRUCTURE`. */
  infra: IndicatorBits;
  /** Health and protection indicators met, as bits over `HEALTH`. */
  health: IndicatorBits;
  /** Reported share of pupils fully immunised, 0-100. */
  imm: number;
  /** Reported share of pupils seen street-begging, 0-100. */
  beg: number;
  /** Mean rating out of 5. 0 means no ratings yet. */
  rating: number;
  /** Number of ratings behind `rating`. */
  nrat: number;
  /** Year established. */
  est: number;
  /** Year curriculum integration began. 0 for schools integrated before the trend window. */
  integYear: number;
  /** Days before the dataset reference date that the school was last visited. */
  visit: number;
}

/** A school with the derived fields the dashboard reads throughout. */
export interface SchoolRecord extends RawSchoolRecord {
  stateName: string;
  lgaName: string;
  zone: string;
  /** `boys + girls`. */
  pupils: number;
  /** True when the school teaches at least one basic-education subject. */
  integrated: boolean;
  /** Lower-cased `name + lgaName + stateName`, used by the search box. */
  search: string;
}

export interface Catalog {
  /** School type labels, indexed by `SchoolRecord.type`. */
  types: string[];
  /** Ownership labels, indexed by `SchoolRecord.own`. */
  own: string[];
  /** Geopolitical zone names. */
  zones: string[];
}

export interface StateProperties {
  name: string;
  zone: string;
}

export interface LgaProperties {
  name: string;
  /** Name of the state this LGA belongs to. */
  state: string;
}

export type PolygonGeometry = {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
};

export interface BoundaryFeature<P> {
  type: 'Feature';
  properties: P;
  geometry: PolygonGeometry;
}

export interface BoundaryCollection<P> {
  type: 'FeatureCollection';
  features: BoundaryFeature<P>[];
}

export type StateCollection = BoundaryCollection<StateProperties>;
export type LgaCollection = BoundaryCollection<LgaProperties>;

/** Boundary geometry, loaded separately from the school records. */
export interface Boundaries {
  states: StateCollection;
  lgas: LgaCollection;
}

/** A `[lat, lon]` pair, in Leaflet's ordering. */
export type LatLng = [number, number];

/** Offline basemap context drawn underneath the Nigeria boundaries. */
export interface Basemap {
  countries: { n: string; g: PolygonGeometry }[];
  countryLabels: { n: string; p: LatLng }[];
  lakes: PolygonGeometry[];
  rivers: PolygonGeometry[];
  cities: { n: string; p: LatLng; r: number }[];
}

/** The three top-level dashboard views. */
export type ViewKey = 'map' | 'chart' | 'grid';

/** Grid sort options. */
export type SortKey = 'visit' | 'pupils' | 'rating' | 'name';

/** Indicator filter groups, keyed by the school field they read. */
export type FilterGroupKey = 'infra' | 'integ' | 'health' | 'type' | 'own' | 'chig' | 'active';

/**
 * How a group combines its ticked options.
 * - `bits`: a school must have EVERY ticked bit.
 * - `enum`: a school must match ANY ticked value.
 */
export type FilterGroupMode = 'bits' | 'enum';

export interface FilterGroup {
  key: FilterGroupKey;
  title: string;
  opts: string[];
  mode: FilterGroupMode;
}

/** Ticked indicator options, per group. */
export type FilterChecks = Record<FilterGroupKey, number[]>;

/** The dashboard's central state, as in the prototype. */
export interface DashboardState {
  view: ViewKey;
  /** Zone name, or '' for all zones. */
  zone: string;
  /** State index as a string, or '' for all states. */
  st: string;
  /** LGA index as a string, or '' for all LGAs. */
  lga: string;
  /** Applied search query. */
  q: string;
  checks: FilterChecks;
  sort: SortKey;
  /** Grid pagination, in pages of `PAGE_SIZE`. */
  page: number;
}

/** Map overlay toggles. */
export interface MapLayers {
  /** Shade areas by school count. */
  choropleth: boolean;
  /** Count bubbles. */
  badges: boolean;
  /** School locations, at LGA / zoomed-in state view. */
  points: boolean;
  /** Basemap selection. */
  basemap: 'offline' | 'none';
}

export type Theme = 'dark' | 'light';

/** Aggregates derived from a filtered list of schools. */
export interface Aggregates {
  /** Number of schools. */
  n: number;
  pupils: number;
  boys: number;
  girls: number;
  /** Pupils under 6. */
  a1: number;
  /** Pupils aged 6-11. */
  a2: number;
  /** Pupils aged 12-17. */
  a3: number;
  mallams: number;
  /** Count of integrated schools. */
  integ: number;
  /** Count of Chigari-supported schools. */
  chig: number;
  /** Count of active schools. */
  active: number;
  /** Count of schools per infrastructure facility. */
  infra: number[];
  /** Count of schools per curriculum subject. */
  curr: number[];
  /** Count of schools per health indicator. */
  health: number[];
  /** Count of schools per type. */
  types: number[];
  /** Count of schools per ownership. */
  own: number[];
  /** Pupil-weighted immunisation total, before averaging. */
  imm: number;
  /** Pupil-weighted street-begging total, before averaging. */
  beg: number;
  /** Pupil-weighted mean immunisation coverage, 0-100. */
  immAvg: number;
  /** Pupil-weighted mean street-begging share, 0-100. */
  begAvg: number;
  /** Pupils per Mallam. */
  ratio: number;
}
