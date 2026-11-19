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

/** 지도 좌표에 붙는 첫 안내 말풍선. 지도를 움직이면 그 자리에 붙어 같이 움직인다. */
export type MapTip = {
  latitude: number;
  longitude: number;
  message: string;
  /** 말풍선을 점 위(기본)나 아래에 둔다. 점이 마커 위치면 마커를 가리지 않게 아래에 둔다. */
  placement?: 'above' | 'below';
  /** `확인`을 눌렀을 때. */
  onConfirm: () => void;
  /** 지도의 다른 곳을 누르거나 지도를 끌기 시작했을 때. 눌림은 그대로 지도에도 전해진다. */
  onInteract: () => void;
  /** 좌표가 화면 밖으로 나갔을 때. */
  onOutOfView: () => void;
};

/** 행정동 정보 카드. 맨 위에 동 이름과 별(북마크), 아래에 `라벨 값` 줄을 둔다. */
export type MapRegionCard = {
  title: string;
  /** 없으면 별을 그리지 않는다(북마크할 수 없는 화면). */
  bookmark?: { isOn: boolean; onToggle: () => void };
  /** 이름 아래 회색 한 줄(업종과 거리 등). */
  subtitle?: string;
  /** 값 없이 글자만 있는 줄(주소 등). */
  lines?: string[];
  rows: { label: string; value: string; isEmpty?: boolean; tone?: 'primary' }[];
  /** 카드 맨 아래 작은 회색 글씨 한 줄. */
  note?: string;
  /** 카드 안 링크 버튼(길찾기 등). 새 탭으로 연다. */
  link?: { label: string; href: string; onClick?: () => void };
  /** 좌표에서 마커 위쪽 가장자리까지의 높이(px). 카드 꼬리 끝이 마커 위쪽에 닿게 그만큼 올린다. 핀은 그림 높이, 가운데가 좌표인 알약은 높이의 절반이다. */
  markerAbove?: number;
  /** 좌표에서 마커 아래쪽 가장자리까지의 높이(px). 카드가 화면 위쪽을 넘어 마커 아래로 뒤집힐 때 쓴다. 핀은 0이다. */
  markerBelow?: number;
};

/** 오른쪽 위 레이어 칸(중개사, 병원, 교통, 편의)에 이어 붙이는 켜고 끄는 항목. 찜한 동네 등. */
export type MapRailExtraItem = {
  key: string;
  label: string;
  ariaLabel: string;
  selected: boolean;
  onToggle: () => void;
  /** 글자 위에 둘 하트 같은 작은 아이콘 표시. */
  icon?: 'heart';
  /** 항목에 붙는 개수 배지. 0이면 두지 않는다. */
  badge?: number;
  /** 눌러도 켜지지 않는 상태(찜한 동네가 하나도 없을 때)라 연한 회색으로 보인다. */
  isMuted?: boolean;
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
    /** 있으면 버튼 대신 정보 카드(동 이름과 별, 값이 있는 줄)로 그린다. */
    card?: MapRegionCard;
    /** 카드 위로 마우스가 들어오고 나갈 때. 마우스가 동 라벨에서 카드로 옮겨 가도 닫히지 않게 한다. */
    onHoverChange?: (hovered: boolean) => void;
  };
  bookmarkControl?: { count: number; isOn: boolean; isDisabled?: boolean; onToggle: () => void };
  /** 처음 한 번 보이는 안내 말풍선. 지도 좌표에 붙어 있다. */
  tip?: MapTip;
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
  /** 구역 위로 마우스가 들어오고 나갈 때(데스크탑). */
  onHoverRegion?: (id: string, hovered: boolean) => void;
};

export type MapRegion = {
  id: string;
  name: string;
  /** 채움과 테두리 색. `dashed`면 테두리를 점선으로 그린다(월세 정보가 없는 동네). */
  appearance?: { fillColor: string; strokeColor: string; fillOpacity?: number; dashed?: boolean };
  isRecommended?: boolean;
  /** 구역 가운데에 동 이름만 작게 둔다(찜한 동네). */
  showsName?: boolean;
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
  /** 평균 월세 글자(예: `55만`). 월세 거래가 없는 동네는 null이다. */
  price: string | null;
  /** 월세 시세를 낸 거래 건수. */
  count: number;
  /** 거래가 적어 시세가 흔들릴 수 있는 동네. 숫자를 회색으로 흐리게 하고, 건수는 읽기 도구에만 알린다. */
  sparse: boolean;
  /** 월세 조건 밖이라 지도에서 회색으로 깐 동네. 라벨도 함께 흐리게 한다. */
  filteredOut: boolean;
  /** 출퇴근 장소까지 걸리는 시간 글자(예: `25분`). 월세 자료가 없는 동네도 이 글자로 라벨을 둔다. */
  commute?: string;
};
