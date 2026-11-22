import type { MapBounds, MapMarker } from '../model/Map';
import { clampToSouthKorea, SOUTH_KOREA_BOUNDS } from './mapLocation';
import { markerAnchorTransform } from './mapMarkerPresentation';
import { MAP_TIMING, markMapTiming } from './mapTiming';
const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
const NAVER_ZOOM_BASE = 20;
const MIN_NAVER_ZOOM = 6;
/** 앱의 가장 가까운 단계(레벨 1)와 같다. 이보다 더 확대하면 네이버 기본 타일이 없어 지도가 빈다. */
const MAX_NAVER_ZOOM = 19;
const toNaverZoom = (level: number): number => clamp(NAVER_ZOOM_BASE - level, MIN_NAVER_ZOOM, MAX_NAVER_ZOOM);
const toMapLevel = (zoom: number): number => clamp(NAVER_ZOOM_BASE - zoom, 1, 14);
let naverSdkPromise: Promise<void> | null = null;
let hasAuthFailed = false;
export const NAVER_AUTH_FAILURE_EVENT = 'jachwi:naver-auth-failure';
export const isNaverSdkAvailable = () => !hasAuthFailed && window.naver?.maps != null;
/** `load()`가 끝난 뒤에 부른다. SDK가 없으면(불러오기 전이거나 인증 실패로 폐기됨) 그 자리에서 오류로 알린다. */
const naverMaps = (): NaverMapsNamespace => {
  const maps = window.naver?.maps;
  if (maps == null) throw new Error('Naver Maps SDK를 불러오지 않았습니다.');
  return maps;
};
const naverSdkUrl = (clientId: string) =>
  `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}&submodules=gl&callback=jachwiNaverSdkReady`;
const NAVER_GL_SCRIPT_URL = 'https://oapi.map.naver.com/openapi/v3/maps-gl.js';

const loadNaverSdk = (clientId: string): Promise<void> => {
  if (hasAuthFailed) return Promise.reject(new Error('Naver Maps 인증에 실패했습니다.'));
  if (naverSdkPromise !== null) return naverSdkPromise;
  if (isNaverSdkAvailable()) return Promise.resolve();
  naverSdkPromise = new Promise((resolve, reject) => {
    // 인증 응답은 SDK ready 이후에도 도착하며, 실패하면 SDK가 내부 객체를 폐기한다.
    window.navermap_authFailure = () => {
      hasAuthFailed = true;
      reject(new Error('Naver Maps 인증에 실패했습니다.'));
      window.dispatchEvent(new Event(NAVER_AUTH_FAILURE_EVENT));
    };
    const existing = document.querySelector<HTMLScriptElement>('script[data-jachwi-naver-map]');
    const ready = () => {
      if (!isNaverSdkAvailable()) {
        naverSdkPromise = null;
        document.querySelector('script[data-jachwi-naver-map]')?.remove();
        reject(new Error('Naver Maps SDK를 불러오지 못했습니다.'));
        return;
      }
      resolve();
    };
    // 기본 스크립트의 load가 아니라 GL을 포함한 전체 SDK 완료 콜백을 기다린다.
    window.jachwiNaverSdkReady = ready;
    if (existing !== null) {
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
    script.src = naverSdkUrl(clientId);
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

/**
 * 지도를 그리기 전에 SDK 파일 받기만 먼저 시작한다. 실행은 지금처럼 지도가 붙을 때 `load`가 한다.
 * 일찍 실행하면 `maps-gl.js` 실행(느린 휴대폰에서 약 2초)이 매물 목록을 그리는 일과 메인 스레드를 다퉈 첫 화면이 늦어졌다.
 * 두 파일 모두 하루 캐시라 나중에 붙는 `<script>`가 받아 둔 응답을 쓴다. `maps-gl.js`는 `maps.js`가 부르는 고정 주소다.
 * 주소가 바뀌어도 받아 둔 파일을 쓰지 않을 뿐 지도는 그대로 뜬다.
 */
export const preloadNaverSdk = (clientId: string): void => {
  if (clientId === '' || isNaverSdkAvailable() || naverSdkPromise !== null) return;
  const preloaded = new Set(
    [...document.querySelectorAll('link[rel="preload"]')].map((link) => link.getAttribute('href')),
  );
  for (const href of [naverSdkUrl(clientId), NAVER_GL_SCRIPT_URL]) {
    if (preloaded.has(href)) continue;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.setAttribute('as', 'script');
    link.href = href;
    document.head.append(link);
  }
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
  animateView: (map: LiveMap, center: LiveLatLng, level: number) => void;
  relayout: (map: LiveMap) => void;
  /**
   * 지도 칸 안 `offset`(px) 자리를 제자리에 두고 확대 단계를 `levelDelta`만큼(소수 가능, 음수면 가까이) 바로 바꾼다.
   * 이 SDK가 지원하지 않으면 false를 돌려준다.
   */
  zoomAround: (map: LiveMap, levelDelta: number, offset: { x: number; y: number }) => boolean;
  /** 오버레이를 넣으면 바로 그려지는 상태인지. GL 지도는 준비 전에 넣은 도형을 로드 순간 한꺼번에 등록한다. */
  isRenderReady: (map: LiveMap) => boolean;
  destroy: (map: LiveMap) => void;
  addListener: (map: LiveMap, event: string, callback: (latitude?: number, longitude?: number) => void) => unknown;
  removeListener: (listener: unknown) => void;
  createOverlay: (map: LiveMap, marker: MapMarker, content: HTMLElement, zIndex: number) => LiveOverlay;
  createCircle: (map: LiveMap, center: LiveLatLng, radius: number) => LiveOverlay;
};

type LiveLatLng = NaverLatLng;
export type LiveMap = NaverMap;
export type LiveOverlay = NaverOverlay;

export const naverEngine = (clientId: string, customStyleId?: string): LiveEngine => ({
  label: 'Naver 지도',
  load: () => loadNaverSdk(clientId),
  createMap: (container, center, level) => {
    const start = clampToSouthKorea(center);
    const maps = naverMaps();
    return new maps.Map(container, {
      ...(customStyleId ? { gl: true, customStyleId } : {}),
      center: new maps.LatLng(start.latitude, start.longitude),
      zoom: toNaverZoom(level),
      // 남한 밖으로는 옮기지도 줄이지도 못하게 막는다.
      minZoom: MIN_NAVER_ZOOM,
      maxZoom: MAX_NAVER_ZOOM,
      maxBounds: new maps.LatLngBounds(
        new maps.LatLng(SOUTH_KOREA_BOUNDS.south, SOUTH_KOREA_BOUNDS.west),
        new maps.LatLng(SOUTH_KOREA_BOUNDS.north, SOUTH_KOREA_BOUNDS.east),
      ),
    });
  },
  latLng: (latitude, longitude) => {
    const { LatLng } = naverMaps();
    return new LatLng(latitude, longitude);
  },
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
  animateView: (map, center, level) => {
    if (map.morph && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
      map.morph(center, toNaverZoom(level), { duration: 180, easing: 'easeOutCubic' });
    else {
      map.setCenter(center);
      map.setZoom(toNaverZoom(level));
    }
  },
  relayout: (map) => map.autoResize(),
  zoomAround: (map, levelDelta, offset) => {
    const Point = window.naver?.maps.Point;
    const projection = map.getProjection?.();
    if (!map.zoomBy || !Point || !projection) return false;
    // 앱 확대 단계는 Naver zoom과 방향이 반대다.
    map.zoomBy(-levelDelta, projection.fromOffsetToCoord(new Point(offset.x, offset.y)), false);
    return true;
  },
  // 공개 idle은 GL 준비보다 먼저 온다. 내부 플래그는 이름이 바뀔 수 있어 호출하는 쪽이 시간 제한을 둔다.
  isRenderReady: (map) => !customStyleId || map._glReady === true,
  destroy: (map) => map.destroy(),
  addListener: (map, event, callback) =>
    naverMaps().Event.addListener(map, event, (value) => callback(value?.coord?.lat(), value?.coord?.lng())),
  removeListener: (listener) => {
    if (listener !== undefined && isNaverSdkAvailable()) naverMaps().Event.removeListener(listener);
  },
  createOverlay: (map, marker, content, zIndex) => {
    const maps = naverMaps();
    const overlay = new maps.OverlayView();
    const position = new maps.LatLng(marker.latitude, marker.longitude);
    // SDK 좌표 이동과 버튼의 중심 정렬을 분리한다. SDK/버튼 스타일이 서로 간섭하지 않게 한다.
    const element = document.createElement('div');
    element.append(content);
    content.style.position = 'absolute';
    content.style.left = '0';
    content.style.top = '0';
    content.style.transform = markerAnchorTransform(marker);
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
        if (element.isConnected) markMapTiming(MAP_TIMING.overlayAttached);
      }
    };
    overlay.onRemove = () => element.remove();
    overlay.setMap(map as NaverMap);
    return overlay;
  },
  createCircle: (map, center, radius) => {
    const { Circle } = naverMaps();
    return new Circle({
      map: map as NaverMap,
      center: center as NaverLatLng,
      radius,
      strokeWeight: 2,
      // 매물 주변 500m 범위는 우리 파랑 테두리와 옅은 파랑 바탕으로 그린다.
      strokeColor: '#3f6fc4',
      strokeOpacity: 0.9,
      fillColor: '#3f6fc4',
      fillOpacity: 0.06,
    });
  },
});
