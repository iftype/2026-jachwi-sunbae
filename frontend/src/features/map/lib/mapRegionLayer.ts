import type { MapRegion } from '../model/MapCanvas';
import { createRegionSummaryElement, regionLabelPosition } from './mapRegionSummary';
import type { LiveMap, LiveOverlay, naverEngine } from './naverMapEngine';

type Engine = Pick<ReturnType<typeof naverEngine>, 'latLng' | 'createOverlay' | 'removeListener'>;
type Polygon = InstanceType<NaverMapsNamespace['Polygon']>;
export const regionAtLevel = (region: MapRegion, level: number): MapRegion => {
  const detail =
    level >= 8 ? region.simplifiedPolygons?.overview : level >= 5 ? region.simplifiedPolygons?.medium : undefined;
  return detail ? { ...region, polygons: detail } : region;
};
const regionStyle = (region: MapRegion, selected: boolean) => ({
  strokeColor: region.appearance?.strokeColor ?? (selected ? '#787b80' : '#a4a7ab'),
  strokeWeight: region.appearance ? (selected ? 2 : 1.25) : selected ? 2 : 1,
  fillColor: region.appearance?.fillColor ?? (region.isRecommended === false && !selected ? '#888888' : '#f5c344'),
  fillOpacity: region.appearance ? (selected ? 0.38 : 0.28) : selected ? 0.5 : region.isRecommended ? 0.24 : 0.08,
  zIndex: selected ? 2 : 1,
});
type Entry = {
  geometry: MapRegion['polygons'] | MapRegion['paths'];
  polygons: Polygon[];
  listeners: unknown[];
  label: LiveOverlay | null;
  summary: HTMLElement | null;
  labelKey: string;
  styleKey: string;
  opacity: number;
  hovered: boolean;
};

/** 지도 하나가 소유한다. 좌표가 같은 동은 유지하고 스타일·라벨 변경만 반영한다. */
export const createMapRegionLayer = (
  map: LiveMap,
  sdk: NaverMapsNamespace,
  engine: Engine,
  onSelect: (id: string) => void,
  getLevel: () => number = () => 4,
) => {
  const entries = new Map<string, Entry>();
  const remove = (entry: Entry) => {
    entry.listeners.forEach(engine.removeListener);
    entry.polygons.forEach((polygon) => polygon.setMap(null));
    entry.label?.setMap(null);
  };
  const hover = (entry: Entry, hovered: boolean) => {
    if (entry.hovered === hovered) return;
    entry.hovered = hovered;
    entry.polygons.forEach((polygon) => polygon.setOptions({ fillOpacity: entry.opacity + (hovered ? 0.1 : 0) }));
    if (entry.summary) entry.summary.dataset.hovered = String(hovered);
  };
  const create = (region: MapRegion, selected: boolean): Entry => {
    const style = regionStyle(region, selected);
    const polygons = (region.polygons ?? [region.paths])
      .filter((paths) => paths.length > 0)
      .map(
        (paths) =>
          new sdk.Polygon({
            map,
            paths: paths.map((ring) => ring.map((point) => engine.latLng(point.latitude, point.longitude))),
            ...style,
            clickable: true,
          }),
      );
    const entry: Entry = {
      geometry: region.polygons ?? region.paths,
      polygons,
      listeners: [],
      label: null,
      summary: null,
      labelKey: '',
      styleKey: JSON.stringify(style),
      opacity: style.fillOpacity,
      hovered: false,
    };
    entry.listeners = polygons.flatMap((polygon) => [
      sdk.Event.addListener(polygon, 'click', () => onSelect(region.id)),
      sdk.Event.addListener(polygon, 'mouseover', () => hover(entry, true)),
      sdk.Event.addListener(polygon, 'mouseout', () => hover(entry, false)),
    ]);
    return entry;
  };
  return {
    sync: (regions: MapRegion[], selectedId: string | null) => {
      const level = getLevel();
      const nextIds = new Set(regions.map((region) => region.id));
      for (const [id, entry] of entries) {
        if (nextIds.has(id)) continue;
        remove(entry);
        entries.delete(id);
      }
      for (const original of regions) {
        const region = regionAtLevel(original, level);
        let entry = entries.get(region.id);
        if (entry && entry.geometry !== (region.polygons ?? region.paths)) {
          const parts = (region.polygons ?? [region.paths]).filter((paths) => paths.length > 0);
          if (entry.polygons.length === parts.length) {
            entry.polygons.forEach((polygon, index) =>
              polygon.setPaths(
                parts[index].map((ring) => ring.map((point) => engine.latLng(point.latitude, point.longitude))),
              ),
            );
            entry.geometry = region.polygons ?? region.paths;
          } else {
            remove(entry);
            entries.delete(region.id);
            entry = undefined;
          }
        }
        const selected = region.id === selectedId;
        if (!entry) {
          entry = create(region, selected);
          entries.set(region.id, entry);
        }
        const style = regionStyle(region, selected);
        const styleKey = JSON.stringify(style);
        if (entry.styleKey !== styleKey) {
          entry.styleKey = styleKey;
          entry.opacity = style.fillOpacity;
          entry.polygons.forEach((polygon) =>
            polygon.setOptions({ ...style, fillOpacity: style.fillOpacity + (entry.hovered ? 0.1 : 0) }),
          );
        }
        // 요약이 없는 통근 경계에는 불필요한 DOM을 만들지 않는다.
        const labelKey = region.summary
          ? JSON.stringify([region.name, region.summary, region.center, region.appearance, selected])
          : '';
        if (entry.labelKey !== labelKey) {
          entry.label?.setMap(null);
          entry.label = null;
          entry.summary = null;
          entry.labelKey = labelKey;
          if (region.summary) {
            const summary = createRegionSummaryElement(region, selected, () => onSelect(region.id));
            summary.dataset.hovered = String(entry.hovered);
            summary.addEventListener('mouseenter', () => hover(entry, true));
            summary.addEventListener('mouseleave', () => hover(entry, false));
            summary.addEventListener('focus', () => hover(entry, true));
            summary.addEventListener('blur', () => hover(entry, false));
            entry.summary = summary;
            entry.label = engine.createOverlay(
              map,
              { id: region.id, label: region.name, ...regionLabelPosition(region) },
              summary,
              5,
            );
          }
        }
      }
    },
    dispose: () => {
      entries.forEach(remove);
      entries.clear();
    },
  };
};
