import type { MapMarker } from '../model/Map';
const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
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
    marker.image?.src ?? '',
    marker.photo ?? '',
    marker.actionable === true ? '1' : '0',
    selectedMarkerId === marker.id ? '1' : '0',
  ].join('|');

/** 매물과 시설 마커는 아래 꼭짓점이 좌표를 가리키는 핀 이미지로 그린다. */
export const isPinMarker = (marker: MapMarker): boolean =>
  marker.image !== undefined ||
  marker.tone === 'property' ||
  marker.tone === 'selected' ||
  marker.tone === 'propertyCluster' ||
  ((marker.tone === 'place' || marker.tone === 'cluster') && marker.category !== undefined);

/** 핀과 말풍선은 아래 가운데가, 나머지 점 마커는 가운데가 좌표에 오게 옮긴다. */
export const markerAnchorTransform = (marker: MapMarker): string =>
  isPinMarker(marker) || marker.tone === 'destination' || marker.tone === 'flash'
    ? 'translate(-50%, -100%)'
    : 'translate(-50%, -50%)';

/** 종류마다 이만큼 자리를 두고 그 안에서 세부 순서를 더한다. 세부 순서가 다음 종류를 넘지 않는다. */
const MARKER_Z_INDEX_TONE_SPAN = 20_000_000;
/** 위도 0.00001도(약 1m) 차이까지 앞뒤를 가린다. 90도 전체가 MARKER_Z_INDEX_TONE_SPAN 안에 든다. */
const LATITUDE_Z_INDEX_PRECISION = 100_000;
const MAX_RANK = 1_000;

const toneZIndex = (marker: MapMarker, selectedMarkerId: string | null): number => {
  if (marker.tone === 'flash') return 11;
  if (selectedMarkerId === marker.id) return 10;
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
  if (marker.tone === 'flash' || selectedMarkerId === marker.id) return tone * MARKER_Z_INDEX_TONE_SPAN;
  return tone * MARKER_Z_INDEX_TONE_SPAN + detailZIndex(marker);
};

/** 지도 위에서 찍은 좌표의 버튼과 메뉴는 모든 마커보다 앞에 둔다. */
export const COORDINATE_ACTION_Z_INDEX = 12 * MARKER_Z_INDEX_TONE_SPAN;
export const COORDINATE_MENU_Z_INDEX = COORDINATE_ACTION_Z_INDEX + 1;

/**
 * 배율에 따라 마커를 키우거나 줄이는 비율. 매물 핀은 가까울수록 키우고 멀수록 줄인다.
 * 거리 메모 말풍선은 골목이 보이는 배율(4)까지 그대로 두고, 그보다 멀리 축소할수록 줄여 넓은 화면을 덮지 않게 한다.
 */
export const markerScale = (marker: MapMarker, level: number): number => {
  if (marker.tone === 'property' || marker.tone === 'selected' || marker.tone === 'propertyCluster')
    return Number(clamp(1 + (4 - level) * 0.12, 0.7, 1.36).toFixed(2));
  if (marker.category === 'MEMO') return Number(clamp(1 - (level - 4) * 0.1, 0.6, 1).toFixed(2));
  return 1;
};
