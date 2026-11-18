import type { MapCoordinate } from './mapLocation';

/** 가려지지 않은 영역의 가운데에 좌표가 보이도록 지도 중심을 옮긴다. Naver GL의 512px 타일 기준이다. */
export const centerWithInsets = (
  point: MapCoordinate,
  level: number,
  padding: { left: number; right: number; top: number; bottom: number },
): MapCoordinate => {
  const worldSize = 512 * 2 ** (20 - level);
  const latitude = (Math.max(-85, Math.min(85, point.latitude)) * Math.PI) / 180;
  const y = (1 - Math.log(Math.tan(Math.PI / 4 + latitude / 2)) / Math.PI) / 2;
  return {
    latitude:
      (Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + (padding.bottom - padding.top) / 2 / worldSize)))) * 180) / Math.PI,
    longitude: point.longitude + ((padding.right - padding.left) / 2 / worldSize) * 360,
  };
};

const METERS_PER_PIXEL_AT_LEVEL_ZERO = 156_543.03 / 2 ** 21;
const METERS_PER_LATITUDE = 111_320;
/** 휴대폰 지도에서 헤더, 버튼, 아래 스위치에 가리지 않는 칸의 대략적인 크기(px). */
const FIT_SIZE = { width: 300, height: 420 } as const;

/**
 * 점들이 모두 보이는 가운데와 확대 단계(작을수록 가까움). 점들이 좁게 모여 있으면 `level`보다 가까이 다가가지 않는다.
 * 점이 없으면 `fallback` 자리를 그대로 쓴다.
 */
export const fitCoordinates = (
  points: readonly MapCoordinate[],
  level: number,
  fallback: MapCoordinate,
): MapCoordinate & { level: number } => {
  if (points.length === 0) return { ...fallback, level };
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const south = Math.min(...latitudes);
  const north = Math.max(...latitudes);
  const west = Math.min(...longitudes);
  const east = Math.max(...longitudes);
  const cosine = Math.cos((((south + north) / 2) * Math.PI) / 180);
  const metersPerPixel = Math.max(
    ((east - west) * METERS_PER_LATITUDE * cosine) / FIT_SIZE.width,
    ((north - south) * METERS_PER_LATITUDE) / FIT_SIZE.height,
  );
  const fitLevel = metersPerPixel === 0 ? level : Math.log2(metersPerPixel / (METERS_PER_PIXEL_AT_LEVEL_ZERO * cosine));
  return { latitude: (south + north) / 2, longitude: (west + east) / 2, level: Math.max(level, Math.ceil(fitLevel)) };
};
