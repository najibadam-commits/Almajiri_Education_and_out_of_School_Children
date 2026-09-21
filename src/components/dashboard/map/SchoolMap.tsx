'use client';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DETAIL_ZOOM } from '@/data/indicators';
import type { Basemap, Boundaries, LatLng, SchoolRecord } from '@/data/types';
import { aggregate, groupByArea } from '@/lib/aggregations';
import { cssVar, fmt, pct } from '@/lib/formatting';
import {
  CITY_LABEL_ZOOM,
  MAX_BOUNDS,
  NIGERIA_BOUNDS,
  badgeSize,
  escapeHtml,
  labelPoint,
  sequentialColor,
  typeColor,
} from '@/lib/map';
import { dataService } from '@/services/dataService';
import { useDashboard } from '@/state/DashboardProvider';
import { MapLegend, type LegendState } from './MapLegend';

/** Precomputed per-state geometry, so bounds are measured once. */
interface StateGeometry {
  bounds: L.LatLngBounds;
  center: LatLng;
}

/**
 * The map view.
 *
 * The Leaflet instance is created once and kept for the life of the view. A
 * filter change updates the layers inside it — polygons, badges, points — and
 * never rebuilds the map, so panning and zoom survive every interaction.
 */
interface SchoolMapProps {
  /** True while the map view is the one on screen. */
  active: boolean;
  /** Reports whether individual schools are currently drawn, for the breadcrumb hint. */
  onDetailedChange: (detailed: boolean) => void;
}

export function SchoolMap({ active, onDetailedChange }: SchoolMapProps) {
  const {
    state,
    layers,
    theme,
    catalog,
    states,
    filterWith,
    fitToken,
    focusRequest,
    openProfile,
    setStateFilter,
    setLgaFilter,
  } = useDashboard();

  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const areaLayer = useRef<L.LayerGroup | null>(null);
  const badgeLayer = useRef<L.LayerGroup | null>(null);
  const pointLayer = useRef<L.LayerGroup | null>(null);
  const focusLayer = useRef<L.LayerGroup | null>(null);
  const baseLayer = useRef<L.LayerGroup | null>(null);
  const pointIndex = useRef(new Map<number, L.Layer>());
  const canvasRenderer = useRef<L.Canvas | null>(null);

  const stateGeometry = useRef<StateGeometry[]>([]);
  const lgaGeometry = useRef(new Map<number, StateGeometry>());
  const lastFit = useRef(fitToken);
  const pendingFit = useRef(false);
  const pendingRender = useRef(false);
  const detailedRef = useRef(false);
  const lastFocus = useRef(0);

  const [geo, setGeo] = useState<{ boundaries: Boundaries; basemap: Basemap } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [legend, setLegend] = useState<LegendState | null>(null);

  // Callbacks the Leaflet event handlers reach for. Held in refs so that the
  // handlers can stay bound for the life of the map.
  const handlers = useRef({ setStateFilter, setLgaFilter, openProfile });
  handlers.current = { setStateFilter, setLgaFilter, openProfile };

  /* ---------- geometry ---------- */

  useEffect(() => {
    let cancelled = false;
    Promise.all([dataService.getBoundaries(), dataService.getBasemap()])
      .then(([boundaries, basemap]) => {
        if (cancelled) return;
        stateGeometry.current = boundaries.states.features.map((feature) => ({
          bounds: L.geoJSON(feature as GeoJSON.Feature).getBounds(),
          center: labelPoint(feature),
        }));
        lgaGeometry.current.clear();
        setGeo({ boundaries, basemap });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setGeoError(
          cause instanceof Error ? cause.message : 'The map boundaries could not be loaded.',
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Bounds and centre for one LGA, measured on first use. */
  const lgaInfo = useCallback(
    (index: number): StateGeometry => {
      const cached = lgaGeometry.current.get(index);
      if (cached) return cached;
      const feature = geo!.boundaries.lgas.features[index];
      const info: StateGeometry = {
        bounds: L.geoJSON(feature as GeoJSON.Feature).getBounds(),
        center: labelPoint(feature),
      };
      lgaGeometry.current.set(index, info);
      return info;
    },
    [geo],
  );

  /* ---------- the map instance ---------- */

  useEffect(() => {
    if (!container.current || map.current) return;

    const instance = L.map(container.current, {
      zoomSnap: 0.25,
      minZoom: 4.5,
      maxBounds: MAX_BOUNDS,
      attributionControl: true,
      zoomControl: false,
    });
    instance.fitBounds(NIGERIA_BOUNDS, { padding: [10, 10] });
    L.control.zoom({ position: 'bottomright' }).addTo(instance);
    instance.attributionControl.setPrefix(false);
    instance.attributionControl.addAttribution(
      'Base map: <a href="https://www.naturalearthdata.com">Natural Earth</a> · ' +
        'Boundaries: <a href="https://www.geoboundaries.org">geoBoundaries</a> / GRID3 (CC BY 4.0) · ' +
        'Schools: SAMPLE DATA',
    );

    instance.createPane('base').style.zIndex = '200';
    const baseLabels = instance.createPane('baseLabels');
    baseLabels.style.zIndex = '420';
    baseLabels.style.pointerEvents = 'none';
    instance.createPane('areas').style.zIndex = '390';
    const focusPane = instance.createPane('focus');
    focusPane.style.zIndex = '395';
    focusPane.style.pointerEvents = 'none';

    canvasRenderer.current = L.canvas({ padding: 0.3 });
    areaLayer.current = L.layerGroup().addTo(instance);
    focusLayer.current = L.layerGroup().addTo(instance);
    pointLayer.current = L.layerGroup().addTo(instance);
    badgeLayer.current = L.layerGroup().addTo(instance);

    // The profile button inside a popup is plain HTML, so it is wired up when
    // the popup opens rather than when the marker is built.
    instance.on('popupopen', (event: L.PopupEvent) => {
      const element = event.popup.getElement()?.querySelector<HTMLElement>('[data-prof]');
      if (!element) return;
      element.onclick = () => {
        const id = Number(element.dataset.prof);
        void dataService.getSchoolById(id).then((school) => {
          if (school) handlers.current.openProfile(school);
        });
      };
    });

    map.current = instance;
    setMapReady(true);

    return () => {
      instance.remove();
      map.current = null;
      setMapReady(false);
    };
  }, []);

  /* ---------- basemap ---------- */

  useEffect(() => {
    const instance = map.current;
    if (!instance || !geo) return;

    if (baseLayer.current) {
      instance.removeLayer(baseLayer.current);
      baseLayer.current = null;
    }
    container.current?.classList.toggle('no-base', layers.basemap === 'none');
    if (layers.basemap !== 'offline') return;

    const { basemap, boundaries } = geo;
    const line = cssVar('--country-line');
    const water = cssVar('--water');
    const group = L.layerGroup();
    const paneOptions = <T extends object>(style: T) =>
      ({ pane: 'base', interactive: false, ...style }) as L.GeoJSONOptions;

    group.addLayer(
      L.geoJSON(
        {
          type: 'FeatureCollection',
          features: basemap.countries.map((c) => ({
            type: 'Feature',
            properties: {},
            geometry: c.g,
          })),
        } as GeoJSON.FeatureCollection,
        paneOptions({
          style: { color: line, weight: 1, fillColor: cssVar('--land-2'), fillOpacity: 1 },
        }),
      ),
    );
    group.addLayer(
      L.geoJSON(
        boundaries.states as unknown as GeoJSON.FeatureCollection,
        paneOptions({
          style: { color: line, weight: 0.8, fillColor: cssVar('--land'), fillOpacity: 1 },
        }),
      ),
    );
    group.addLayer(
      L.geoJSON(
        {
          type: 'FeatureCollection',
          features: basemap.rivers.map((g) => ({ type: 'Feature', properties: {}, geometry: g })),
        } as GeoJSON.FeatureCollection,
        paneOptions({ style: { color: water, weight: 1.4, opacity: 0.9 } }),
      ),
    );
    group.addLayer(
      L.geoJSON(
        {
          type: 'FeatureCollection',
          features: basemap.lakes.map((g) => ({ type: 'Feature', properties: {}, geometry: g })),
        } as GeoJSON.FeatureCollection,
        paneOptions({ style: { stroke: false, fillColor: water, fillOpacity: 1 } }),
      ),
    );

    basemap.countryLabels.forEach((c) =>
      group.addLayer(
        L.marker(c.p, {
          pane: 'baseLabels',
          interactive: false,
          keyboard: false,
          icon: L.divIcon({
            className: 'base-lbl country',
            html: escapeHtml(c.n),
            iconSize: [120, 16],
            iconAnchor: [60, 8],
          }),
        }),
      ),
    );

    // City labels would crowd the national view, so they appear on zoom in.
    const cities = L.layerGroup();
    basemap.cities.forEach((c) =>
      cities.addLayer(
        L.marker(c.p, {
          pane: 'baseLabels',
          interactive: false,
          keyboard: false,
          icon: L.divIcon({
            className: 'base-lbl city',
            html: `<i></i>${escapeHtml(c.n)}`,
            iconSize: [110, 14],
            iconAnchor: [4, 7],
          }),
        }),
      ),
    );

    const syncCities = () => {
      const show = instance.getZoom() >= CITY_LABEL_ZOOM;
      if (show && !group.hasLayer(cities)) group.addLayer(cities);
      if (!show && group.hasLayer(cities)) group.removeLayer(cities);
    };
    instance.on('zoomend', syncCities);
    syncCities();

    baseLayer.current = group.addTo(instance);

    return () => {
      instance.off('zoomend', syncCities);
    };
  }, [geo, layers.basemap, theme, mapReady]);

  /* ---------- overlays ---------- */

  const renderOverlays = useCallback(
    (fit: boolean) => {
      const instance = map.current;
      if (!instance || !geo) return;

      // A zero-sized container cannot be projected against, so no camera move
      // is attempted against one.
      const size = instance.getSize();
      const canMove = size.x > 0 && size.y > 0;

      areaLayer.current?.clearLayers();
      badgeLayer.current?.clearLayers();
      pointLayer.current?.clearLayers();
      focusLayer.current?.clearLayers();
      pointIndex.current.clear();

      const { boundaries } = geo;
      const stroke = cssVar('--map-stroke');
      const ink = cssVar('--text-secondary');
      const tooltip = (name: string, list: SchoolRecord[]) => {
        const a = aggregate(list);
        return (
          `<b>${escapeHtml(name)}</b><span>${fmt(a.n)} schools · ${fmt(a.pupils)} pupils<br>` +
          `${pct(a.integ, a.n)}% integrated · ${fmt(a.chig)} Chigari-supported</span>`
        );
      };

      if (state.st === '') {
        /* National or zone level: one polygon per state. */
        detailedRef.current = false;
        onDetailedChange(false);
        const list = filterWith({ ignoreState: true });
        const by = groupByArea(list, 'st');
        const max = Math.max(1, ...[...by.values()].map((v) => v.length));

        boundaries.states.features.forEach((feature, index) => {
          const inZone = !state.zone || feature.properties.zone === state.zone;
          const schools = by.get(index) ?? [];
          const layer = L.geoJSON(feature as GeoJSON.Feature, {
            pane: 'areas',
            style: {
              color: inZone ? ink : stroke,
              weight: inZone ? 1 : 0.6,
              opacity: inZone ? 0.7 : 0.4,
              dashArray: '3 3',
              fillColor:
                layers.choropleth && inZone ? sequentialColor(schools.length, max) : 'transparent',
              fillOpacity: inZone ? 0.62 : 0,
            },
          });

          if (inZone) {
            layer.bindTooltip(tooltip(`${feature.properties.name} State`, schools), {
              className: 'cf-tip',
              sticky: true,
            });
            layer.on('click', () => handlers.current.setStateFilter(String(index)));
            layer.on(
              'mouseover',
              (e: L.LeafletEvent) =>
                (e as L.LayerEvent).layer &&
                ((e as L.LayerEvent).layer as L.Path).setStyle({ weight: 2.5, opacity: 1 }),
            );
            layer.on(
              'mouseout',
              (e: L.LeafletEvent) =>
                (e as L.LayerEvent).layer &&
                ((e as L.LayerEvent).layer as L.Path).setStyle({ weight: 1, opacity: 0.7 }),
            );
          }
          areaLayer.current?.addLayer(layer);

          if (layers.badges && inZone && schools.length) {
            badgeLayer.current?.addLayer(
              countBadge(
                stateGeometry.current[index].center,
                schools.length,
                feature.properties.name,
                () => handlers.current.setStateFilter(String(index)),
              ),
            );
          }
        });

        setLegend({ title: 'Schools per state', max, showTypes: false });

        if (fit && canMove) {
          if (state.zone) {
            let bounds: L.LatLngBounds | null = null;
            boundaries.states.features.forEach((feature, index) => {
              if (feature.properties.zone !== state.zone) return;
              const b = stateGeometry.current[index].bounds;
              bounds = bounds
                ? bounds.extend(b)
                : L.latLngBounds(b.getSouthWest(), b.getNorthEast());
            });
            if (bounds) instance.flyToBounds(bounds, { padding: [30, 30], duration: 0.6 });
          } else {
            instance.flyToBounds(NIGERIA_BOUNDS, { padding: [10, 10], duration: 0.6 });
          }
        }
        return;
      }

      /* State or LGA level: one polygon per LGA, plus schools when close in. */
      const stateIndex = Number(state.st);
      const stateName = states[stateIndex]?.name;
      const list = filterWith();
      // At LGA level the neighbouring LGAs keep their own counts, so the
      // choropleth still gives the selected LGA something to read against.
      const stateList =
        state.lga === ''
          ? list
          : filterWith({ ignoreState: true }).filter((s) => s.st === stateIndex);
      const by = groupByArea(stateList, 'lga');
      const max = Math.max(1, ...[...by.values()].map((v) => v.length));

      const targetBounds =
        state.lga !== ''
          ? lgaInfo(Number(state.lga)).bounds
          : stateGeometry.current[stateIndex].bounds;
      const targetZoom =
        fit && canMove
          ? instance.getBoundsZoom(targetBounds, false, L.point(60, 60))
          : instance.getZoom();
      const detailed = state.lga !== '' || targetZoom >= DETAIL_ZOOM;
      detailedRef.current = detailed;
      onDetailedChange(detailed);

      focusLayer.current?.addLayer(
        L.geoJSON(boundaries.states.features[stateIndex] as GeoJSON.Feature, {
          pane: 'focus',
          style: { color: cssVar('--accent-strong'), weight: 2.5, fill: false },
        }),
      );

      boundaries.lgas.features.forEach((feature, index) => {
        if (feature.properties.state !== stateName) return;
        const schools = by.get(index) ?? [];
        const selected = state.lga === String(index);
        const dimmed = state.lga !== '' && !selected;

        const layer = L.geoJSON(feature as GeoJSON.Feature, {
          pane: 'areas',
          style: {
            color: selected ? cssVar('--accent-strong') : ink,
            weight: selected ? 3 : 0.8,
            opacity: 0.8,
            fillColor: layers.choropleth ? sequentialColor(schools.length, max) : 'transparent',
            fillOpacity: dimmed ? 0.2 : selected ? 0.3 : 0.6,
          },
        });
        layer.bindTooltip(tooltip(`${feature.properties.name} LGA`, schools), {
          className: 'cf-tip',
          sticky: true,
        });
        layer.on('click', () => handlers.current.setLgaFilter(String(index)));
        areaLayer.current?.addLayer(layer);

        if (layers.badges && schools.length && !detailed) {
          badgeLayer.current?.addLayer(
            countBadge(lgaInfo(index).center, schools.length, feature.properties.name, () =>
              handlers.current.setLgaFilter(String(index)),
            ),
          );
        }
      });

      if (layers.points && detailed) {
        list.forEach((school) => {
          const colour = typeColor(school.type);
          const marker =
            school.type === 3
              ? L.marker([school.lat, school.lon], {
                  icon: L.divIcon({
                    className: 'badge-ico',
                    html: `<div style="width:12px;height:12px;transform:rotate(45deg);background:${colour};border:2px solid ${stroke}"></div>`,
                    iconSize: [12, 12],
                  }),
                  title: school.name,
                })
              : L.circleMarker([school.lat, school.lon], {
                  renderer: canvasRenderer.current ?? undefined,
                  radius: state.lga !== '' ? 6 : 4.5,
                  color: stroke,
                  weight: 1.5,
                  fillColor: colour,
                  fillOpacity: school.active ? 0.95 : 0.35,
                });

          marker.bindPopup(popupHtml(school, catalog.types[school.type]), { maxWidth: 260 });
          marker.bindTooltip(escapeHtml(school.name), {
            className: 'cf-tip',
            direction: 'top',
            offset: [0, -4],
          });
          pointLayer.current?.addLayer(marker);
          pointIndex.current.set(school.id, marker);
        });
      }

      setLegend({ title: 'Schools per LGA', max, showTypes: layers.points && detailed });

      if (fit && canMove) instance.flyToBounds(targetBounds, { padding: [30, 30], duration: 0.6 });
    },
    [
      geo,
      state.st,
      state.lga,
      state.zone,
      layers,
      filterWith,
      states,
      catalog.types,
      lgaInfo,
      onDetailedChange,
    ],
  );

  // Redraws whenever the filters, the overlays or the theme change. A fit only
  // happens when the location changed, so toggling a layer does not move the map.
  //
  // While the chart or grid view is on screen the map is still mounted but has
  // no size, and Leaflet cannot measure a zero-sized container: asking it to
  // fit bounds there produces NaN coordinates. So work is deferred until the
  // map is visible again, and any fit owed to it is remembered.
  useEffect(() => {
    if (!mapReady || !geo) return;

    if (fitToken !== lastFit.current) {
      lastFit.current = fitToken;
      pendingFit.current = true;
    }

    if (!active) {
      pendingRender.current = true;
      return;
    }

    // The container has just been shown, so Leaflet needs to re-measure it
    // before anything reads its size.
    map.current?.invalidateSize();

    const fit = pendingFit.current;
    pendingFit.current = false;
    pendingRender.current = false;
    renderOverlays(fit);
  }, [mapReady, geo, renderOverlays, fitToken, theme, active]);

  // Crossing the detail zoom inside a state swaps count bubbles for schools.
  useEffect(() => {
    const instance = map.current;
    if (!instance || !geo) return;
    const onZoomEnd = () => {
      if (!active || state.st === '' || state.lga !== '') return;
      if (instance.getZoom() >= DETAIL_ZOOM !== detailedRef.current) renderOverlays(false);
    };
    instance.on('zoomend', onZoomEnd);
    return () => {
      instance.off('zoomend', onZoomEnd);
    };
  }, [geo, state.st, state.lga, renderOverlays, active]);

  // Centres on a school chosen from search, once its markers exist.
  useEffect(() => {
    const instance = map.current;
    if (!instance || !focusRequest || focusRequest.token === lastFocus.current) return;
    lastFocus.current = focusRequest.token;
    const { school } = focusRequest;
    instance.stop();
    instance.setView([school.lat, school.lon], 12, { animate: false });
    // The marker is created by the render pass that this focus triggered, so
    // the popup opens on the next frame.
    requestAnimationFrame(() => {
      const marker = pointIndex.current.get(school.id);
      if (marker && 'openPopup' in marker) (marker as L.CircleMarker).openPopup();
    });
  }, [focusRequest, geo]);

  /** Keeps Leaflet's size in step when the surrounding layout changes. */
  useEffect(() => {
    const instance = map.current;
    if (!instance || !container.current) return;
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [mapReady]);

  return (
    <>
      <div id="map" ref={container} role="region" aria-label="Map of schools" />
      {geoError && (
        <div className="state-pane" style={{ position: 'absolute', inset: 0, zIndex: 700 }}>
          <div className="inner">
            <h2>The map could not be loaded</h2>
            <p>{geoError}</p>
            <p>The chart and grid views still work with the current filters.</p>
          </div>
        </div>
      )}
      {!geo && !geoError && (
        <div className="state-pane" style={{ position: 'absolute', inset: 0, zIndex: 700 }}>
          <div className="inner">
            <div className="spinner" />
            <p>Loading state and LGA boundaries…</p>
          </div>
        </div>
      )}
      <MapLegend legend={legend} showChoropleth={layers.choropleth} types={catalog.types} />
    </>
  );
}

/** A clickable count bubble over an area's centre. */
function countBadge(at: LatLng, count: number, label: string, onClick: () => void): L.Marker {
  const size = badgeSize(count);
  const marker = L.marker(at, {
    icon: L.divIcon({
      className: 'badge-ico',
      html: `<div class="count-badge" style="width:${size}px;height:${size}px">${fmt(count)}</div>`,
      iconSize: [size, size],
    }),
    keyboard: true,
    title: `${label}: ${fmt(count)} schools`,
    riseOnHover: true,
  });
  marker.on('click', onClick);
  return marker;
}

/** The popup shown when a school marker is clicked. */
function popupHtml(school: SchoolRecord, typeLabel: string): string {
  return `<div class="pop"><h4>${escapeHtml(school.name)}</h4>
  <div class="loc">${escapeHtml(school.lgaName)} LGA · ${escapeHtml(school.stateName)}</div>
  <div class="kv">
    <span>Type</span><span>${escapeHtml(typeLabel)}</span>
    <span>Pupils</span><span>${fmt(school.pupils)}</span>
    <span>Mallams</span><span>${school.mallams}</span>
    <span>Integrated</span><span>${school.integrated ? 'Yes' : 'No'}</span>
    <span>Chigari support</span><span>${school.chig ? 'Yes' : 'No'}</span>
    <span>Status</span><span>${school.active ? 'Active' : 'Inactive'}</span>
  </div>
  <button data-prof="${school.id}">View school profile</button>
  <div class="sample-tag">Sample record</div></div>`;
}
