import { FACILITY_MARKER_LEVEL, facilityMarkersVisible } from '@/features/map/lib/mapFacilityVisibility';
import type { MapCoordinate } from '@/features/map/lib/mapLocation';

/** 확대하거나 축소하는 방향과 관계없이 같은 단계에서 시설 마커를 표시한다. 작은 값일수록 가까운 지도다. */
export const PLACES_SHOW_LEVEL = FACILITY_MARKER_LEVEL;
export const nextPlacesVisible = facilityMarkersVisible;

/** 동네를 고를 때 가장 가까이 다가가는 단계(작을수록 가까움). 작은 동네도 이보다 다가가 골목만 보이게 하지 않는다. */
export const AREA_FOCUS_MIN_LEVEL = 5;
/** 동네를 고를 때 가장 멀리 두는 단계. 고르자마자 정류장과 부동산 마커가 보이도록 마커를 올리는 단계에 맞춘다. */
export const AREA_FOCUS_MAX_LEVEL = PLACES_SHOW_LEVEL;
/** 경계를 아직 받지 못한 동네를 고를 때의 단계. */
export const AREA_FOCUS_FALLBACK_LEVEL = 6;
/**
 * 동네 경계가 여백을 두고 들어가야 하는 지도 칸 크기(px). 휴대폰 390px에서 좌우 여백과 아래 시트를 뺀 칸과,
 * 데스크탑에서 정보 칸이 열려 좁아진 지도 칸 중 작은 쪽에 맞춘다.
 */
const AREA_FIT_SIZE = { width: 340, height: 300 } as const;
/** 확대 단계 0(Naver zoom 21)에서 적도의 1px이 덮는 거리(m). Naver 지도는 512px 타일을 쓴다. */
const METERS_PER_PIXEL_AT_LEVEL_ZERO = 156_543.03 / 2 ** 21;
const METERS_PER_LATITUDE = 111_320;
/** 동네를 고르지 않은 결과 지도의 확대 단계. 결과 동네 전체가 보이도록 멀리 둔다. */
export const RESULT_OVERVIEW_LEVEL = 10;

/** Web Mercator의 픽셀 간격을 사용해 결과가 지도 중앙보다 48px 위에 보이게 한다. */
export const resultMapCenter = (point: MapCoordinate, level: number): MapCoordinate => {
  const latitude = (Math.max(-85, Math.min(85, point.latitude)) * Math.PI) / 180;
  const worldSize = 256 * 2 ** (20 - level);
  const y = (1 - Math.log(Math.tan(Math.PI / 4 + latitude / 2)) / Math.PI) / 2;
  const shiftedLatitude = (Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 48 / worldSize)))) * 180) / Math.PI;
  return { latitude: shiftedLatitude, longitude: point.longitude };
};

/**
 * 점들이 여백을 두고 `AREA_FIT_SIZE` 칸 안에 모두 들어오는 확대 단계. 너무 가깝거나 멀지 않게 `min`~`max` 안으로 자른다.
 * 점이 없으면 `fallback`을 쓴다.
 */
const fitLevel = (
  points: readonly MapCoordinate[],
  min: number,
  max: number,
  fallback: number,
  size: { width: number; height: number } = AREA_FIT_SIZE,
): number => {
  if (!points.length) return fallback;
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);
  const cosine = Math.cos((((south + north) / 2) * Math.PI) / 180);
  const widthMeters = (Math.max(...longitudes) - Math.min(...longitudes)) * METERS_PER_LATITUDE * cosine;
  const heightMeters = (north - south) * METERS_PER_LATITUDE;
  const metersPerPixel = Math.max(widthMeters / size.width, heightMeters / size.height);
  if (metersPerPixel === 0) return min;
  // 확대 단계가 1 멀어질 때마다 1px이 덮는 거리가 두 배가 된다.
  const level = Math.log2(metersPerPixel / (METERS_PER_PIXEL_AT_LEVEL_ZERO * cosine));
  return Math.min(max, Math.max(min, level));
};

const outerRingPoints = (polygons: readonly (readonly (readonly MapCoordinate[])[])[]) =>
  polygons.flatMap((polygon) => polygon[0] ?? []);

/**
 * 동네 경계 전체가 여백을 두고 보이는 확대 단계. 동네 크기와 상관없이 같은 단계로 다가가면 큰 동네는 한 귀퉁이만 보인다.
 * 너무 가깝거나 멀지 않게 `AREA_FOCUS_MIN_LEVEL`~`AREA_FOCUS_MAX_LEVEL` 안으로 자른다.
 */
export const areaFocusLevel = (polygons: readonly (readonly (readonly MapCoordinate[])[])[]): number =>
  fitLevel(outerRingPoints(polygons), AREA_FOCUS_MIN_LEVEL, AREA_FOCUS_MAX_LEVEL, AREA_FOCUS_FALLBACK_LEVEL);

/**
 * 결과 지도 칸의 크기와, 그 안에서 다른 것이 가리는 여백(px). 데스크탑은 동네를 고르면 열릴 상세 칸 폭을 미리 빼고
 * 색 기준과 버튼 자리를, 휴대폰은 위 조건 줄과 아래 동네 시트 높이를 여백으로 준다.
 */
export type MapViewport = {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
};
/** 가려지지 않은 칸 안에서도 경로가 가장자리에 붙지 않고 주변이 보이게, 칸의 이 비율 안에 담는다. */
const VIEWPORT_FIT_RATIO = 0.75;
/** 여백을 빼고 남은 칸이 이보다 작으면 이 크기로 본다. 아주 작은 창에서 너무 멀리 가지 않게 한다. */
const MIN_FIT_SIZE = 160;

/** 지도 중심을 화면에서 (dx, dy)px 옮긴 좌표. Naver GL은 512px 타일이라 단계 0(Naver zoom 20)의 세계 폭은 512 x 2^20px이다. */
const shiftByPixels = (point: MapCoordinate, level: number, dx: number, dy: number): MapCoordinate => {
  const worldSize = 512 * 2 ** (20 - level);
  const latitude = (Math.max(-85, Math.min(85, point.latitude)) * Math.PI) / 180;
  const y = (1 - Math.log(Math.tan(Math.PI / 4 + latitude / 2)) / Math.PI) / 2 + dy / worldSize;
  return {
    latitude: (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI,
    longitude: point.longitude + (dx / worldSize) * 360,
  };
};

/**
 * 통근 경로 전체(출발 정류장이나 동네 경계부터 출퇴근 장소까지)가 한 화면에 들어오는 시점.
 * 상위 동네나 출발 정류장을 고를 때 쓴다. 경로보다 가깝게 다가가면 출퇴근 장소가 화면 밖으로 나가 경로를 가늠하지 못한다.
 * 가장 가깝게는 `AREA_FOCUS_MIN_LEVEL`, 가장 멀게는 결과 전체를 보는 `RESULT_OVERVIEW_LEVEL`까지 둔다.
 */
export const routeFocusView = (
  points: readonly MapCoordinate[],
  polygons: readonly (readonly (readonly MapCoordinate[])[])[] = [],
  viewport?: MapViewport,
  maximumLevel = RESULT_OVERVIEW_LEVEL,
): MapCoordinate & { level: number } => {
  const all = [...points, ...outerRingPoints(polygons)];
  // 지도 칸을 알면 가려지지 않는 칸의 일부에 담고, 모르면(첫 렌더, 테스트) 정해 둔 칸에 담는다.
  const { padding } = viewport ?? { padding: { top: 0, right: 0, bottom: 0, left: 0 } };
  const size = viewport && {
    width: Math.max(MIN_FIT_SIZE, viewport.width - padding.left - padding.right) * VIEWPORT_FIT_RATIO,
    height: Math.max(MIN_FIT_SIZE, viewport.height - padding.top - padding.bottom) * VIEWPORT_FIT_RATIO,
  };
  const level = fitLevel(all, AREA_FOCUS_MIN_LEVEL, maximumLevel, AREA_FOCUS_FALLBACK_LEVEL, size);
  if (!all.length) return { latitude: 0, longitude: 0, level };
  const latitudes = all.map((point) => point.latitude);
  const longitudes = all.map((point) => point.longitude);
  const middle = {
    latitude: (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
    longitude: (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
  };
  if (!viewport) return { ...resultMapCenter(middle, level), level };
  // 가려지지 않은 칸의 가운데에 경로 가운데가 오게, 지도 중심을 여백 차이의 절반만큼 반대로 옮긴다.
  const dx = (padding.right - padding.left) / 2;
  const dy = (padding.bottom - padding.top) / 2;
  return { ...shiftByPixels(middle, level, dx, dy), level };
};

const REM = 16;

/**
 * 데스크탑 결과 지도 칸. 옆 칸은 동네 대중교통 상세에만 열려 평소 지도 칸 폭은 그대로다.
 * 왼쪽은 지도 안 월세 필터(위)와 마커 정보 카드(아래)가 차지하는 폭(22rem과 여백), 오른쪽은 확대 축소와 레일 줄, 위아래는 가장자리 여백을 비운다.
 * 옆 칸이 열린 상태(`isDetailOpen`)는 지도 칸 크기가 이미 줄어 있으므로 따로 빼지 않는다.
 */
export const desktopMapViewport = (
  map: { width: number; height: number },
  _layout?: { width: number; isDetailOpen: boolean },
): MapViewport | null => {
  if (map.width === 0 || map.height === 0) return null;
  return {
    width: map.width,
    height: map.height,
    padding: { top: 24, right: 5 * REM, bottom: 40, left: 24 * REM },
  };
};

/** 휴대폰 동네 시트가 처음 열리는 높이(지도 칸의 %). 동네 이름, 통근, 월세 요약까지 보이고 지도와 고른 동이 같이 보이게 낮게 둔다. */
export const MOBILE_AREA_SHEET_PERCENT = 30;
/** 지도 시점을 맞출 때 아래에서 비우는 비율. 동네를 고르면 동네 시트가 이만큼 덮는다. */
const MOBILE_AREA_SHEET_RATIO = MOBILE_AREA_SHEET_PERCENT / 100;

/** 휴대폰과 태블릿 결과 지도 칸. 위는 결과 머리(`headerBottom`, 지도 칸 위에서부터 px), 오른쪽은 확대 축소와 레일 줄, 아래는 정보 시트 높이를 비운다. */
export const mobileMapViewport = (map: { width: number; height: number }, headerBottom: number): MapViewport | null => {
  if (map.width === 0 || map.height === 0) return null;
  return {
    width: map.width,
    height: map.height,
    padding: { top: headerBottom + 8, right: 4.5 * REM, bottom: map.height * MOBILE_AREA_SHEET_RATIO + 16, left: 16 },
  };
};
