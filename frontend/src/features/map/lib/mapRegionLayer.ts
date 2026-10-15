import type { MapRegion } from '../model/MapCanvas';
import { createRegionSummaryElement, regionLabelPosition } from './mapRegionSummary';
import type { LiveMap, LiveOverlay, naverEngine } from './naverMapEngine';

type Engine = Pick<ReturnType<typeof naverEngine>, 'latLng' | 'createOverlay' | 'removeListener'> &
  Partial<Pick<ReturnType<typeof naverEngine>, 'isRenderReady' | 'getCenter'>>;
/** 한 번에 등록하는 새 동 수. GL 지도는 도형마다 레이어를 검증·직렬화해 많이 넣으면 한 프레임이 길어진다. */
const STAGE_CHUNK = 40;
/** GL 준비 신호를 못 받아도 이 시간이 지나면 그린다. */
const READY_TIMEOUT_MS = 3000;
type Polygon = InstanceType<NaverMapsNamespace['Polygon']>;
const anchorOf = (region: MapRegion) => region.center ?? region.polygons?.[0]?.[0]?.[0] ?? region.paths[0]?.[0];
/** 화면 중심에서 가까운 순서를 정하는 용도라 위도에 따른 경도 축척만 맞춘 근사 거리다. */
const distanceSquared = (
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number } | undefined,
) => {
  if (!to) return Infinity;
  const dLatitude = to.latitude - from.latitude;
  const dLongitude = (to.longitude - from.longitude) * Math.cos((from.latitude * Math.PI) / 180);
  return dLatitude * dLatitude + dLongitude * dLongitude;
};
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
  // 처음 그릴 때 GL 등록이 한 프레임에 몰리지 않도록 drawStage 순서로 나눠 만든다.
  let latest: { regions: MapRegion[]; selectedId: string | null } = { regions: [], selectedId: null };
  let allowedStage = Infinity;
  let staging = false;
  const createdAt = performance.now();
  // GL 준비 전에 넣은 도형은 SDK가 모아 두었다가 로드 순간 한 프레임에 등록하므로 준비될 때까지 미룬다.
  const renderReady = () => (engine.isRenderReady?.(map) ?? true) || performance.now() - createdAt >= READY_TIMEOUT_MS;
  let pendingFrame: number | null = null;
  const cancelPending = () => {
    if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
    pendingFrame = null;
  };
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
  const apply = () => {
    const { regions, selectedId } = latest;
    const level = getLevel();
    // 나눠 그리는 중이면 이번 묶음에 넣을 동을 고른다. 같은 단계 안에서는 지금 화면 중심에 가까운 동부터 넣는다.
    let toCreate: Set<string> | null = null;
    if (staging) {
      const center = engine.getCenter?.(map);
      const candidates = renderReady()
        ? regions.filter((region) => !entries.has(region.id) && (region.drawStage ?? 0) <= allowedStage)
        : [];
      if (center) {
        const distance = new Map(candidates.map((region) => [region.id, distanceSquared(center, anchorOf(region))]));
        candidates.sort((a, b) => distance.get(a.id)! - distance.get(b.id)!);
      }
      toCreate = new Set(candidates.slice(0, STAGE_CHUNK).map((region) => region.id));
    }
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
      if (!entry && toCreate && !toCreate.has(region.id)) continue;
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
    const waiting = regions.filter((region) => !entries.has(region.id)).map((region) => region.drawStage ?? 0);
    if (waiting.length === 0) {
      allowedStage = Infinity;
      staging = false;
      return;
    }
    // 다음 묶음은 SDK가 이번 묶음을 GL에 등록한 프레임 다음에 만든다. 같은 단계가 남아 있으면 그 단계를 이어 간다.
    const nextStage = Math.min(...waiting);
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = requestAnimationFrame(() => {
        pendingFrame = null;
        allowedStage = nextStage;
        apply();
      });
    });
  };
  return {
    sync: (regions: MapRegion[], selectedId: string | null) => {
      cancelPending();
      // 이미 그려진 동이 하나도 없는 새 결과만 단계를 나눈다. 선택·확대 같은 갱신은 바로 반영한다.
      if (!regions.some((region) => entries.has(region.id))) {
        const stages = regions.map((region) => region.drawStage ?? 0);
        allowedStage = stages.length ? Math.min(...stages) : Infinity;
        staging = stages.length > 0;
      }
      latest = { regions, selectedId };
      apply();
    },
    dispose: () => {
      cancelPending();
      entries.forEach(remove);
      entries.clear();
    },
  };
};
