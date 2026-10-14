import type { MapCoordinate } from '@/features/map/lib/mapLocation';

/** Web Mercator의 픽셀 간격을 사용해 결과가 지도 중앙보다 48px 위에 보이게 한다. */
export const resultMapCenter = (point: MapCoordinate, level: number): MapCoordinate => {
  const latitude = (Math.max(-85, Math.min(85, point.latitude)) * Math.PI) / 180;
  const worldSize = 256 * 2 ** (20 - level);
  const y = (1 - Math.log(Math.tan(Math.PI / 4 + latitude / 2)) / Math.PI) / 2;
  const shiftedLatitude = (Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 48 / worldSize)))) * 180) / Math.PI;
  return { latitude: shiftedLatitude, longitude: point.longitude };
};
