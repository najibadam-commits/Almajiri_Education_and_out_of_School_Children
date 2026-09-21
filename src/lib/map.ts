import type { BoundaryFeature, LatLng, PolygonGeometry } from '@/data/types';
import { cssVar } from './formatting';

/** Nigeria's extent, used for the home view. */
export const NIGERIA_BOUNDS: [LatLng, LatLng] = [
  [4.2, 2.7],
  [13.9, 14.7],
];

/** How far the map may be panned away from Nigeria. */
export const MAX_BOUNDS: [LatLng, LatLng] = [
  [1, -2],
  [17, 20],
];

/** Zoom at or above which city labels are drawn on the offline basemap. */
export const CITY_LABEL_ZOOM = 7.5;

/** The sequential ramp used by the choropleth, light to dark. */
export const SEQUENTIAL_STEPS = [
  '--seq-0',
  '--seq-1',
  '--seq-2',
  '--seq-3',
  '--seq-4',
  '--seq-5',
] as const;

/**
 * Picks a ramp colour for `value` against `max`.
 * Zero is transparent, so an area with no schools is not shaded at all.
 */
export function sequentialColor(value: number, max: number): string {
  if (!value) return 'transparent';
  const index = Math.max(
    0,
    Math.min(SEQUENTIAL_STEPS.length - 1, Math.ceil((value / max) * SEQUENTIAL_STEPS.length) - 1),
  );
  return cssVar(SEQUENTIAL_STEPS[index]);
}

/** The categorical colour for a school type. */
export function typeColor(type: number): string {
  return cssVar(`--series-${type + 1}`);
}

/**
 * The visual centre of a boundary feature, as `[lat, lon]`.
 *
 * Uses the polygon centroid of the feature's largest ring, so that a state
 * whose shape includes small outlying parts still labels on its mainland.
 */
export function labelPoint(feature: BoundaryFeature<unknown>): LatLng {
  const geometry = feature.geometry as PolygonGeometry;
  const polygons =
    geometry.type === 'Polygon'
      ? [geometry.coordinates as number[][][]]
      : (geometry.coordinates as number[][][][]);

  let best: LatLng = [0, 0];
  let bestArea = -1;

  for (const polygon of polygons) {
    const ring = polygon[0];
    let area = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const cross = ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
      area += cross;
      cx += (ring[i][0] + ring[i + 1][0]) * cross;
      cy += (ring[i][1] + ring[i + 1][1]) * cross;
    }
    if (Math.abs(area) > bestArea && area !== 0) {
      bestArea = Math.abs(area);
      // Coordinates are [lon, lat]; Leaflet wants [lat, lon].
      best = [cy / (3 * area), cx / (3 * area)];
    }
  }

  return best;
}

/** Badge diameter for a school count, matching the prototype's steps. */
export function badgeSize(count: number): number {
  if (count >= 1000) return 46;
  if (count >= 100) return 40;
  if (count >= 10) return 32;
  return 26;
}

/** Escapes text going into Leaflet tooltip and popup HTML. */
export function escapeHtml(value: string): string {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c] as string,
  );
}
