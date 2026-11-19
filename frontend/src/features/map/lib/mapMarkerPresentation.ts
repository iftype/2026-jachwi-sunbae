import type { MapMarker } from '../model/Map';
const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
/** `selectedMarkerId`로 골랐거나 마커 스스로 `selected`인 마커. */
export const isMarkerSelected = (marker: MapMarker, selectedMarkerId: string | null | undefined): boolean =>
  marker.selected === true || selectedMarkerId === marker.id;

/** 이 값이 같으면 마커를 다시 그릴 필요가 없다. */
export const markerSignature = (marker: MapMarker, selectedMarkerId: string | null): string =>
  [
    marker.latitude,
    marker.longitude,
    marker.tone ?? '',
    marker.category ?? '',
    marker.variant ?? '',
    marker.color ?? '',
    marker.count ?? '',
    marker.rank ?? '',
    marker.label,
    marker.caption ?? '',
    marker.summary?.amount ?? '',
    marker.photo ?? '',
    marker.actionable === true ? '1' : '0',
    isMarkerSelected(marker, selectedMarkerId) ? '1' : '0',
  ].join('|');

/** 매물과 시설 마커는 아래 꼭짓점이 좌표를 가리키는 핀 이미지로 그린다. */
export const isPinMarker = (marker: MapMarker): boolean =>
  marker.tone === 'property' ||
  marker.tone === 'selected' ||
  marker.tone === 'propertyCluster' ||
  ((marker.tone === 'place' || marker.tone === 'cluster') && marker.category !== undefined);

/** 핀과 말풍선은 아래 가운데가, 나머지 점 마커는 가운데가 좌표에 오게 옮긴다. */
export const markerAnchorTransform = (marker: MapMarker): string =>
  isPinMarker(marker) || marker.tone === 'destination' || marker.tone === 'pinLabel' || marker.tone === 'flash'
    ? 'translate(-50%, -100%)'
    : 'translate(-50%, -50%)';

/** 종류마다 이만큼 자리를 두고 그 안에서 세부 순서를 더한다. 세부 순서가 다음 종류를 넘지 않는다. */
const MARKER_Z_INDEX_TONE_SPAN = 20_000_000;
/** 위도 0.00001도(약 1m) 차이까지 앞뒤를 가린다. 90도 전체가 MARKER_Z_INDEX_TONE_SPAN 안에 든다. */
const LATITUDE_Z_INDEX_PRECISION = 100_000;
const MAX_RANK = 1_000;

const toneZIndex = (marker: MapMarker, selectedMarkerId: string | null): number => {
  // 검색해서 고른 곳과 지도를 눌러 고른 곳의 라벨은 동 라벨, 지도 글자, 다른 마커보다 위에 둔다.
  if (marker.tone === 'pinLabel') return 12;
  if (marker.tone === 'flash') return 11;
  if (isMarkerSelected(marker, selectedMarkerId)) return 10;
  if (marker.tone === 'selected') return 9;
  if (marker.tone === 'property' || marker.tone === 'propertyCluster') return 8;
  if (marker.tone === 'current') return 7;
  if (marker.tone === 'rank') return 6;
  return 5;
};

/** 같은 종류 안의 세부 순서. 순위 알약은 순위가 높을수록, 나머지는 화면 아래(남쪽)에 있을수록 앞에 둔다. */
const detailZIndex = (marker: MapMarker): number => {
  if (marker.tone === 'rank' && marker.rank !== undefined)
    return MAX_RANK - clamp(Math.round(marker.rank), 1, MAX_RANK);
  return Math.round((90 - clamp(marker.latitude, -90, 90)) * LATITUDE_Z_INDEX_PRECISION);
};

/**
 * 종류별 순서(flash > 지금 고른 마커 > selected > 매물 > 현재 위치 > 순위 > 나머지)를 먼저 지키고,
 * 같은 종류끼리는 detailZIndex로 앞뒤를 정한다. flash와 지금 고른 마커는 하나뿐이라 세부 순서가 없다.
 */
export const markerZIndex = (marker: MapMarker, selectedMarkerId: string | null): number => {
  const tone = toneZIndex(marker, selectedMarkerId);
  if (marker.tone === 'flash' || isMarkerSelected(marker, selectedMarkerId)) return tone * MARKER_Z_INDEX_TONE_SPAN;
  return tone * MARKER_Z_INDEX_TONE_SPAN + detailZIndex(marker);
};

/** 이름만 두는 동 이름표(찜한 동네)는 가장 높은 종류(pinLabel)의 마커 자리 바로 아래에 둔다. 그 마커와 위로는 섞이지 않는다. */
export const REGION_NAME_LABEL_Z_INDEX = 12 * MARKER_Z_INDEX_TONE_SPAN - 1;
/**
 * 좌표에 붙는 버튼과 눌러 고른 동네 정보 카드의 z-index. 지도 위에 올리는 것 가운데 맨 위다.
 * 층 순서(아래에서 위): 동 이름표 < 종류별 마커(5~12, 내 매물 말풍선과 시설 마커와 출퇴근 장소 라벨 포함) < 이 카드와 버튼 < 좌표 메뉴.
 * 마우스를 올려 뜨는 동네 카드도 같은 자리를 쓰지만, 눌러 고른 동네가 있으면 호버 카드는 뜨지 않아 둘이 겹치지 않는다.
 * 마커 종류를 더하면 이 값이 가장 높은 종류의 자리(`종류 번호 * MARKER_Z_INDEX_TONE_SPAN`) 위에 오도록 같이 올린다.
 */
export const COORDINATE_ACTION_Z_INDEX = 13 * MARKER_Z_INDEX_TONE_SPAN;
export const COORDINATE_MENU_Z_INDEX = COORDINATE_ACTION_Z_INDEX + 1;

/**
 * 배율에 따라 마커를 키우거나 줄이는 비율. 매물 핀은 가까울수록 키우고 멀수록 줄인다.
 * 거리 메모 말풍선은 골목이 보이는 배율(4)까지 그대로 두고, 그보다 멀리 축소할수록 줄여 넓은 화면을 덮지 않게 한다.
 */
/** 라벨을 일부만 보이는 8단계와 모두 보이는 5단계에서 같은 크기 경계를 쓴다. */
/** 이 단계보다 멀리 보면 마커 글자(월세 등 라벨)를 숨기고 점이나 작은 핀만 남긴다. */
export const FAR_MARKER_LEVEL = 8;
export const mapZoomScale = (level: number): number => {
  // 가까이 볼수록 크고 멀수록 작다. 가까운 단계를 기준(100%)으로 중간 단계는 80%, 먼 단계는 60% 안팎까지 줄인다.
  if (level > FAR_MARKER_LEVEL) return 0.6;
  if (level > 5) return 0.8;
  if (level > 3) return 1.1;
  if (level > 1) return 1.35;
  return 1.6;
};
/**
 * 내가 기록한 방 사진 카드 마커의 고정 배율. 확대 단계가 바뀌어도 크기가 변하지 않는다.
 * 확대 중간 단계(4와 5단계)에서 줄였던 크기(1.1 * 0.88)와 같다.
 */
export const PHOTO_MARKER_SCALE = 0.968;
const isPhotoPropertyMarker = (marker: MapMarker): boolean =>
  marker.photo !== undefined && (marker.tone === 'property' || marker.tone === 'propertyCluster');
export const markerScale = (marker: MapMarker, level: number): number => {
  if (isPhotoPropertyMarker(marker)) return PHOTO_MARKER_SCALE;
  if (marker.category === 'MEMO') return Number(clamp(1 - (level - 4) * 0.1, 0.6, 1).toFixed(2));
  if (marker.tone === 'current' || marker.tone === 'flash') return 1;
  return mapZoomScale(level);
};
