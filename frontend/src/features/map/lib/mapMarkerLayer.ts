import type { MapMarker } from '../model/Map';
import { FAR_MARKER_LEVEL, markerScale, markerSignature, markerZIndex } from './mapMarkerPresentation';
import type { LiveMap, LiveOverlay, naverEngine } from './naverMapEngine';

type Engine = Pick<ReturnType<typeof naverEngine>, 'createOverlay'>;
type Entry = { signature: string; overlay: LiveOverlay; content: HTMLElement };
type CreateElement = (marker: MapMarker, selectedMarkerId: string | null) => HTMLElement;

/**
 * 지도에서 내린 마커를 다시 쓰려고 들고 있는 최대 개수. 동네 시트 탭을 오가면 화면 안 버스정류장(수백 개)과
 * 공인중개사가 번갈아 내려가므로 한 화면 분량은 넉넉히 들고 있는다.
 */
export const PARKED_MARKER_LIMIT = 600;

/**
 * 지도 하나가 소유하는 DOM 마커 레이어. 달라진 마커만 다시 그리고, 내린 마커는 모양이 같으면 다시 붙여 쓴다.
 * 탭을 바꿀 때마다 마커 수백 개를 새로 만들면(`renderToStaticMarkup`) 그때마다 메인 스레드를 오래 쓴다.
 * 지금 요청에 없는 마커는 반드시 지도에서 내려 이전 탭 마커가 남지 않게 한다.
 */
export const createMapMarkerLayer = (map: LiveMap, engine: Engine, createElement: CreateElement) => {
  let live = new Map<string, Entry>();
  // 내린 마커. 같은 마커도 선택 여부처럼 모양이 다르면 따로 들고 있는다(id와 모양으로 찾는다).
  // 넣은 순서대로 들고 있다가 한도를 넘으면 오래된 것부터 버린다.
  const parked = new Map<string, Entry>();
  const parkedKey = (id: string, signature: string) => `${id}\n${signature}`;
  const park = (id: string, entry: Entry) => {
    entry.overlay.setMap(null);
    const key = parkedKey(id, entry.signature);
    parked.delete(key);
    parked.set(key, entry);
    while (parked.size > PARKED_MARKER_LIMIT) parked.delete(parked.keys().next().value as string);
  };

  return {
    sync: (markers: MapMarker[], selectedMarkerId: string | null, level: number) => {
      const previous = live;
      const next = new Map<string, Entry>();
      for (const marker of markers) {
        const signature = markerSignature(marker, selectedMarkerId);
        let entry = previous.get(marker.id);
        if (entry !== undefined) previous.delete(marker.id);
        if (entry !== undefined && entry.signature !== signature) {
          park(marker.id, entry);
          entry = undefined;
        }
        if (entry === undefined) {
          const kept = parked.get(parkedKey(marker.id, signature));
          if (kept !== undefined) {
            parked.delete(parkedKey(marker.id, signature));
            kept.overlay.setMap(map);
            entry = kept;
          }
        }
        if (entry === undefined) {
          const content = createElement(marker, selectedMarkerId);
          entry = {
            signature,
            content,
            overlay: engine.createOverlay(map, marker, content, markerZIndex(marker, selectedMarkerId)),
          };
        }
        entry.content.style.setProperty('--map-marker-scale', String(markerScale(marker, level)));
        // 멀리 볼 때는 마커 라벨 글자를 숨긴다(CSS의 `data-far`).
        entry.content.dataset.far = String(level > FAR_MARKER_LEVEL);
        next.set(marker.id, entry);
      }
      previous.forEach((entry, id) => park(id, entry));
      live = next;
    },
    /** 지도를 없앨 때 부른다. SDK가 이미 사라졌으면(`sdkGone`) 오버레이를 건드리지 않는다. */
    dispose: (sdkGone = false) => {
      if (!sdkGone) live.forEach(({ overlay }) => overlay.setMap(null));
      live.clear();
      parked.clear();
    },
  };
};
