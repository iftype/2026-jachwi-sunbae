declare const __API_BASE_URL__: string;
declare const __MAP_PROVIDER_MODE__: string;
declare const __NAVER_MAP_CLIENT_ID__: string;
declare const __POSTHOG_PROJECT_TOKEN__: string;
declare const __POSTHOG_HOST__: string;
declare const __APP_VERSION__: string;
declare const __APP_ENVIRONMENT__: 'production' | 'development';
declare const __ENABLE_MSW__: boolean;
declare const __COMMUTE_DATA_SOURCE__: 'mock' | 'server';
declare const __ADMIN_BOUNDARY_BASE_URL__: string;

interface Window {
  jachwiNaverSdkReady?: () => void;
  navermap_authFailure?: () => void;
  naver?: { maps: NaverMapsNamespace };
}

type NaverLatLng = { lat: () => number; lng: () => number };
type NaverLatLngBounds = { getSW: () => NaverLatLng; getNE: () => NaverLatLng };
type NaverPoint = { x: number; y: number };
type NaverMap = {
  /** GL 모드의 내부 준비 상태. 공개 API가 아니므로 없을 수 있다. */
  _glReady?: boolean;
  getBounds: () => NaverLatLngBounds;
  getCenter: () => NaverLatLng;
  getZoom: () => number;
  setCenter: (center: NaverLatLng) => void;
  setZoom: (zoom: number) => void;
  /** 확대 단계를 `deltaZoom`만큼(소수 가능) 바꾼다. `origin` 좌표가 화면에서 제자리에 남는다. `effect`가 false면 바로 옮긴다. */
  zoomBy?: (deltaZoom: number, origin?: NaverLatLng, effect?: boolean) => void;
  getProjection?: () => { fromOffsetToCoord: (offset: NaverPoint) => NaverLatLng };
  morph?: (center: NaverLatLng, zoom: number, options: { duration: number; easing: string }) => void;
  refresh: () => void;
  autoResize: () => void;
  destroy: () => void;
};
type NaverOverlay = {
  setMap: (map: NaverMap | null) => void;
  setPosition?: (position: NaverLatLng) => void;
  getProjection?: () => { fromCoordToOffset: (position: NaverLatLng) => { x: number; y: number } };
  getPanes?: () => { overlayLayer: HTMLElement };
  onAdd?: () => void;
  draw?: () => void;
  onRemove?: () => void;
};
type NaverMapsNamespace = {
  LatLng: new (latitude: number, longitude: number) => NaverLatLng;
  LatLngBounds: new (sw: NaverLatLng, ne: NaverLatLng) => NaverLatLngBounds;
  Point?: new (x: number, y: number) => NaverPoint;
  Map: new (
    container: HTMLElement,
    options: {
      center: NaverLatLng;
      zoom: number;
      gl?: boolean;
      customStyleId?: string;
      minZoom?: number;
      maxZoom?: number;
      maxBounds?: NaverLatLngBounds;
    },
  ) => NaverMap;
  OverlayView: new (...args: never[]) => NaverOverlay;
  Polygon: new (options: {
    map: NaverMap;
    paths: NaverLatLng[][];
    strokeWeight: number;
    strokeColor: string;
    strokeOpacity?: number;
    /** 테두리 모양. 네이버 지도 v3는 `solid`, `shortdash` 등을 받는다. */
    strokeStyle?: 'solid' | 'shortdash';
    fillColor: string;
    fillOpacity: number;
    clickable: boolean;
    zIndex: number;
  }) => NaverOverlay & {
    setPaths: (paths: NaverLatLng[][]) => void;
    setOptions: (options: {
      fillOpacity?: number;
      fillColor?: string;
      strokeColor?: string;
      strokeWeight?: number;
      strokeStyle?: 'solid' | 'shortdash';
      zIndex?: number;
    }) => void;
  };
  Polyline: new (options: {
    map: NaverMap;
    path: NaverLatLng[];
    strokeWeight: number;
    strokeColor: string;
    strokeOpacity?: number;
    strokeStyle?: string;
    strokeLineCap?: string;
    strokeLineJoin?: string;
    zIndex?: number;
  }) => NaverOverlay;
  Circle: new (options: {
    map: NaverMap;
    center: NaverLatLng;
    radius: number;
    strokeWeight: number;
    strokeColor: string;
    strokeOpacity: number;
    fillColor: string;
    fillOpacity: number;
  }) => NaverOverlay;
  Event: {
    addListener: (target: object, eventName: string, callback: (event?: { coord?: NaverLatLng }) => void) => unknown;
    removeListener: (listener: unknown) => void;
  };
};

declare module '*.svg' {
  const source: string;
  export default source;
}

declare module '*.png' {
  const source: string;
  export default source;
}

declare module '*.webp' {
  const source: string;
  export default source;
}

declare module '*.jpg' {
  const source: string;
  export default source;
}

declare module '*.mp4' {
  const source: string;
  export default source;
}
