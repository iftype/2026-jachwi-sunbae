import type { MapBounds, MapMarker } from '../model/Map';
import { clampToSouthKorea, SOUTH_KOREA_BOUNDS } from './mapLocation';
const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
const NAVER_ZOOM_BASE = 20;
const MIN_NAVER_ZOOM = 6;
const toNaverZoom = (level: number): number => clamp(NAVER_ZOOM_BASE - level, MIN_NAVER_ZOOM, 21);
const toMapLevel = (zoom: number): number => clamp(NAVER_ZOOM_BASE - zoom, 1, 14);
let naverSdkPromise: Promise<void> | null = null;

const loadNaverSdk = (clientId: string): Promise<void> => {
  if (window.naver?.maps !== undefined) return Promise.resolve();
  if (naverSdkPromise !== null) return naverSdkPromise;
  naverSdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-jachwi-naver-map]');
    const ready = () => {
      if (window.naver?.maps === undefined) {
        naverSdkPromise = null;
        document.querySelector('script[data-jachwi-naver-map]')?.remove();
        reject(new Error('Naver Maps SDK를 불러오지 못했습니다.'));
        return;
      }
      resolve();
    };
    if (existing !== null) {
      existing.addEventListener('load', ready, { once: true });
      existing.addEventListener(
        'error',
        () => {
          naverSdkPromise = null;
          existing.remove();
          reject(new Error('Naver Maps SDK를 불러오지 못했습니다.'));
        },
        {
          once: true,
        },
      );
      return;
    }
    const script = document.createElement('script');
    script.dataset.jachwiNaverMap = 'true';
    script.async = true;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
    script.addEventListener('load', ready, { once: true });
    script.addEventListener(
      'error',
      () => {
        naverSdkPromise = null;
        script.remove();
        reject(new Error('Naver Maps SDK를 불러오지 못했습니다.'));
      },
      { once: true },
    );
    document.head.append(script);
  });
  return naverSdkPromise;
};

export type LiveEngine = {
  label: string;
  load: () => Promise<void>;
  createMap: (container: HTMLElement, center: { latitude: number; longitude: number }, level: number) => LiveMap;
  latLng: (latitude: number, longitude: number) => LiveLatLng;
  getCenter: (map: LiveMap) => { latitude: number; longitude: number };
  getZoom: (map: LiveMap) => number;
  getBounds: (map: LiveMap) => MapBounds;
  setCenter: (map: LiveMap, center: LiveLatLng) => void;
  setZoom: (map: LiveMap, level: number) => void;
  relayout: (map: LiveMap) => void;
  destroy: (map: LiveMap) => void;
  addListener: (map: LiveMap, event: string, callback: (latitude?: number, longitude?: number) => void) => unknown;
  removeListener: (listener: unknown) => void;
  createOverlay: (map: LiveMap, marker: MapMarker, content: HTMLElement, zIndex: number) => LiveOverlay;
  createCircle: (map: LiveMap, center: LiveLatLng, radius: number) => LiveOverlay;
};

type LiveLatLng = NaverLatLng;
export type LiveMap = NaverMap;
export type LiveOverlay = NaverOverlay;

export const naverEngine = (clientId: string): LiveEngine => ({
  label: 'Naver 지도',
  load: () => loadNaverSdk(clientId),
  createMap: (container, center, level) => {
    const start = clampToSouthKorea(center);
    return new window.naver!.maps.Map(container, {
      center: new window.naver!.maps.LatLng(start.latitude, start.longitude),
      zoom: toNaverZoom(level),
      // 남한 밖으로는 옮기지도 줄이지도 못하게 막는다.
      minZoom: MIN_NAVER_ZOOM,
      maxBounds: new window.naver!.maps.LatLngBounds(
        new window.naver!.maps.LatLng(SOUTH_KOREA_BOUNDS.south, SOUTH_KOREA_BOUNDS.west),
        new window.naver!.maps.LatLng(SOUTH_KOREA_BOUNDS.north, SOUTH_KOREA_BOUNDS.east),
      ),
    });
  },
  latLng: (latitude, longitude) => new window.naver!.maps.LatLng(latitude, longitude),
  getCenter: (map) => {
    const center = (map as NaverMap).getCenter();
    return { latitude: center.lat(), longitude: center.lng() };
  },
  getZoom: (map) => toMapLevel((map as NaverMap).getZoom()),
  getBounds: (map) => {
    const bounds = map.getBounds();
    const sw = bounds.getSW();
    const ne = bounds.getNE();
    return { south: sw.lat(), west: sw.lng(), north: ne.lat(), east: ne.lng() };
  },
  setCenter: (map, center) => (map as NaverMap).setCenter(center as NaverLatLng),
  setZoom: (map, level) => (map as NaverMap).setZoom(toNaverZoom(level)),
  relayout: (map) => map.autoResize(),
  destroy: (map) => map.destroy(),
  addListener: (map, event, callback) =>
    window.naver!.maps.Event.addListener(map, event, (value) => callback(value?.coord?.lat(), value?.coord?.lng())),
  removeListener: (listener) => {
    if (listener !== undefined && window.naver?.maps !== undefined) window.naver.maps.Event.removeListener(listener);
  },
  createOverlay: (map, marker, content, zIndex) => {
    const overlay = new window.naver!.maps.OverlayView();
    const position = new window.naver!.maps.LatLng(marker.latitude, marker.longitude);
    // SDK 좌표 이동과 버튼의 중심 정렬을 분리한다. SDK/버튼 스타일이 서로 간섭하지 않게 한다.
    const element = document.createElement('div');
    element.append(content);
    content.style.position = 'absolute';
    content.style.left = '0';
    content.style.top = '0';
    // 회전된 물방울의 끝은 원형 이미지 중심에서 높이의 sqrt(2)/2만큼 아래에 있다.
    const isPin = marker.tone === 'property' || marker.tone === 'selected';
    content.style.transform = isPin ? 'translate(-50%, -120.710678%)' : 'translate(-50%, -50%)';
    element.style.position = 'absolute';
    element.style.top = '0';
    element.style.left = '0';
    element.style.width = '0';
    element.style.height = '0';
    element.style.willChange = 'transform';
    element.style.zIndex = String(zIndex);
    overlay.setPosition?.(position);
    overlay.onAdd = () => overlay.getPanes?.().overlayLayer.append(element);
    overlay.draw = () => {
      const projection = overlay.getProjection?.();
      if (projection !== undefined && overlay.getPanes !== undefined) {
        const pixel = projection.fromCoordToOffset(position);
        // 확대·이동 중 left/top을 바꾸면 WebView가 마커마다 레이아웃을 다시 계산한다.
        // 합성 단계에서 처리되는 transform으로 옮겨 지도 제스처의 메인 스레드 부담을 줄인다.
        element.style.transform = `translate3d(${pixel.x}px, ${pixel.y}px, 0)`;
      }
    };
    overlay.onRemove = () => element.remove();
    overlay.setMap(map as NaverMap);
    return overlay;
  },
  createCircle: (map, center, radius) =>
    new window.naver!.maps.Circle({
      map: map as NaverMap,
      center: center as NaverLatLng,
      radius,
      strokeWeight: 2,
      strokeColor: '#555555',
      strokeOpacity: 0.58,
      fillColor: '#999999',
      fillOpacity: 0.08,
    }),
});
