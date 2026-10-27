import type { MapBounds, MapMarker } from './Map';
export type MapRadiusCircle = {
  radiusMeters: 500 | 1000 | 2000;
  label: string;
};

/** 지도에서 찍은 한 지점에서 고를 수 있는 동작. 데스크탑은 찍은 자리 말풍선(coordinateMenu), 휴대폰은 아래 시트로 그린다. */
export type MapTapAction = {
  id: string;
  label: string;
  onSelect: () => void;
};

export type MapCoordinateMenu = {
  latitude: number;
  longitude: number;
  /** 말풍선 위에 붙는 짧은 안내. */
  title?: string;
  actions: MapTapAction[];
  onClose: () => void;
};

export type MapCanvasProps = {
  animateView?: boolean;
  coordinateAction?: {
    latitude: number;
    longitude: number;
    label: string;
    disabled?: boolean;
    placement?: 'above';
    onClick: () => void;
  };
  /** 찍은 좌표에 고정된 동작 말풍선. 꼬리 끝이 좌표를 가리킨다. */
  coordinateMenu?: MapCoordinateMenu;
  center: { latitude: number; longitude: number };
  markers?: MapMarker[];
  circles?: MapRadiusCircle[];
  level?: number;
  /** 발행된 네이버 스타일 ID. 지정한 지도만 GL 렌더링을 사용한다. */
  customStyleId?: string;
  interactive?: boolean;
  showCenterPin?: boolean;
  /** 화면이 자체 로딩 안내로 지도를 덮고 있으면 지도 준비 안내를 숨겨 로딩이 두 개 돌지 않게 한다. */
  hideLoading?: boolean;
  showRadiusLabels?: boolean;
  selectedMarkerId?: string | null;
  onSelectMarker?: (marker: MapMarker) => void;
  onSelectLocation?: (latitude: number, longitude: number) => void;
  onCenterChange?: (latitude: number, longitude: number) => void;
  onLevelChange?: (level: number) => void;
  onBoundsChange?: (bounds: MapBounds) => void;
  radiusCenter?: { latitude: number; longitude: number };
  /** 지도 좌표에 고정된 선택 가능 구역. */
  regions?: MapRegion[];
  selectedRegionId?: string | null;
  /** 찍은 좌표를 알면 함께 넘긴다(실제 지도만). */
  onSelectRegion?: (id: string, point?: { latitude: number; longitude: number }) => void;
};

export type MapRegion = {
  id: string;
  name: string;
  appearance?: { fillColor: string; strokeColor: string };
  isRecommended?: boolean;
  /** 처음 그릴 때의 순서. 낮은 단계부터 한 프레임씩 나눠 지도에 등록한다. 없으면 0이다. */
  drawStage?: number;
  /** 구역 위 두 칸으로 표시할 요약. 화면이 아니라 지도 좌표에 고정한다. */
  summary?: { travel?: string; price?: string };
  center?: { latitude: number; longitude: number };
  /** MultiPolygon의 분리된 면과 각 면의 내부 링을 유지한다. */
  polygons?: { latitude: number; longitude: number }[][][];
  simplifiedPolygons?: {
    overview: { latitude: number; longitude: number }[][][];
    medium: { latitude: number; longitude: number }[][][];
  };
  paths: { latitude: number; longitude: number }[][];
};
