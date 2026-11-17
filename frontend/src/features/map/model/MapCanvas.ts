import type { MapBounds, MapMarker } from './Map';
export type MapRadiusCircle = {
  radiusMeters: 500 | 1000 | 2000;
  label: string;
};

/** 지도에서 찍은 한 지점에서 고를 수 있는 동작. 데스크탑은 찍은 자리 말풍선(coordinateMenu), 휴대폰은 아래 시트로 그린다. */
export type MapTapAction = {
  id: string;
  label: string;
  /** 글자 앞에 둘 작은 그림 주소. 이모지 대신 쓴다. */
  icon?: string;
  onSelect: () => void;
};

export type MapCoordinateMenu = {
  latitude: number;
  longitude: number;
  /** 화면 낭독기가 읽는 말풍선 이름. 화면에는 쓰지 않는다. */
  title?: string;
  actions: MapTapAction[];
};

export type MapCanvasProps = {
  animateView?: boolean;
  onRetry?: () => void;
  /** 지도가 처음 그려져 쓸 수 있게 되면 부른다. 데모 지도는 바로 부른다. 급하지 않은 요청을 이 뒤로 미룰 때 쓴다. */
  onReady?: () => void;
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
  /** 사용자가 손가락이나 마우스로 지도를 끌기 시작할 때. 화면이 시점을 옮길 때는 부르지 않는다. */
  onDragStart?: () => void;
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
  /** 지도에 가까이 다가갔을 때 동 이름 아래에 붙이는 월세 줄. 없으면 동 이름만 둔다. */
  rentLabel?: MapRegionRentLabel;
  center?: { latitude: number; longitude: number };
  /** MultiPolygon의 분리된 면과 각 면의 내부 링을 유지한다. */
  polygons?: { latitude: number; longitude: number }[][][];
  simplifiedPolygons?: {
    overview: { latitude: number; longitude: number }[][][];
    medium: { latitude: number; longitude: number }[][][];
  };
  paths: { latitude: number; longitude: number }[][];
};

export type MapRegionRentLabel = {
  /** 평균 월세 글자(예: `55만`). */
  price: string;
  /** 월세 시세를 낸 거래 건수. */
  count: number;
  /** 거래가 적어 시세가 흔들릴 수 있는 동네. 숫자를 회색으로 흐리게 하고, 건수는 읽기 도구에만 알린다. */
  sparse: boolean;
  /** 월세 조건 밖이라 지도에서 회색으로 깐 동네. 라벨도 함께 흐리게 한다. */
  filteredOut: boolean;
};
