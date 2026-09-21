import type { FilterGroup, FilterGroupKey } from './types';

/**
 * Indicator labels. The position of each label is its bit position in the
 * matching school field, so the order of these arrays is load-bearing and
 * must stay in step with the dataset.
 */

/** Bits of `SchoolRecord.infra`. */
export const INFRASTRUCTURE = [
  'Permanent classroom structure',
  'Toilets / latrines',
  'Safe drinking water',
  'Sleeping quarters for pupils',
  'School feeding programme',
  'Solar / power supply',
] as const;

/** Bits of `SchoolRecord.integ`. */
export const CURRICULUM = [
  'Literacy (reading & writing)',
  'Numeracy',
  'English language',
  'Basic science',
] as const;

/** Bits of `SchoolRecord.health`. */
export const HEALTH = [
  'Pupils reached in last polio round',
  'Health check-up in last 6 months',
  'Child-protection focal person',
] as const;

export const CHIGARI_SUPPORT = ['Not yet supported', 'Chigari-supported'] as const;
export const SCHOOL_STATUS = ['Inactive', 'Active'] as const;

/** Short labels for the pupil age bands `a1`, `a2` and `a3`. */
export const AGE_BANDS = ['Under 6', '6–11', '12–17'] as const;

/** The same bands as they are written in the chart view. */
export const AGE_BAND_LABELS = ['Under 6 years', '6–11 years', '12–17 years'] as const;

/**
 * Builds the sidebar's indicator groups. `types` and `own` come from the
 * dataset catalog, so the groups cannot be a module constant.
 */
export function buildFilterGroups(types: string[], own: string[]): FilterGroup[] {
  return [
    { key: 'infra', title: 'Infrastructure & WASH', opts: [...INFRASTRUCTURE], mode: 'bits' },
    { key: 'integ', title: 'Curriculum integration', opts: [...CURRICULUM], mode: 'bits' },
    { key: 'health', title: 'Health & Protection', opts: [...HEALTH], mode: 'bits' },
    { key: 'type', title: 'School Type', opts: types, mode: 'enum' },
    { key: 'own', title: 'Ownership', opts: own, mode: 'enum' },
    { key: 'chig', title: 'Chigari Support', opts: [...CHIGARI_SUPPORT], mode: 'enum' },
    { key: 'active', title: 'School Status', opts: [...SCHOOL_STATUS], mode: 'enum' },
  ];
}

/** Every group key, in sidebar order. */
export const FILTER_GROUP_KEYS: FilterGroupKey[] = [
  'infra',
  'integ',
  'health',
  'type',
  'own',
  'chig',
  'active',
];

/**
 * The date the sample dataset counts `SchoolRecord.visit` back from.
 * 01 Sep 2026, matching the prototype's "last updated" note.
 */
export const DATA_REFERENCE_DATE = Date.UTC(2026, 8, 1);

/** Quarters covered by the illustrative curriculum-integration trend. */
export const TREND_START_YEAR = 2023;
export const TREND_END_YEAR = 2026;
export const TREND_END_QUARTER = 3;

/** Schools rendered per page in the grid view. */
export const PAGE_SIZE = 24;

/** Zoom level at or above which individual schools are drawn on the map. */
export const DETAIL_ZOOM = 9;
