import type { MapBounds, MapMarker } from './Map';
export type MapRadiusCircle = {
  radiusMeters: 500 | 1000 | 2000;
  label: string;
};

export type MapCanvasProps = {
  center: { latitude: number; longitude: number };
  markers?: MapMarker[];
  circles?: MapRadiusCircle[];
  level?: number;
  /** 발행된 네이버 스타일 ID. 지정한 지도만 GL 렌더링을 사용한다. */
  customStyleId?: string;
  interactive?: boolean;
  showCenterPin?: boolean;
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
  onSelectRegion?: (id: string) => void;
};

export type MapRegion = {
  id: string;
  name: string;
  appearance?: { fillColor: string; strokeColor: string; glowColor?: string };
  isRecommended?: boolean;
  /** 구역 위 두 칸으로 표시할 요약. 화면이 아니라 지도 좌표에 고정한다. */
  summary?: { travel?: string; price?: string };
  center?: { latitude: number; longitude: number };
  /** MultiPolygon의 분리된 면과 각 면의 내부 링을 유지한다. */
  polygons?: { latitude: number; longitude: number }[][][];
  paths: { latitude: number; longitude: number }[][];
};
