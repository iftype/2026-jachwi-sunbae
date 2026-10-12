import type { MapCoordinate } from './mapLocation';

/** 확대 수준을 유지하면서 선택 위치가 화면의 왼쪽 위(42%, 40%)에 보이도록 중심을 계산한다. */
export const getMapFocusCenter = (
  coordinate: MapCoordinate,
  level: number,
  width: number,
  height: number,
): MapCoordinate => {
  const worldPixels = 256 * 2 ** Math.max(6, 20 - level);
  const radians = (coordinate.latitude * Math.PI) / 180;
  const mercatorY = Math.log(Math.tan(Math.PI / 4 + radians / 2));
  return {
    longitude: coordinate.longitude + (width * 0.08 * 360) / worldPixels,
    latitude: (Math.atan(Math.sinh(mercatorY - (height * 0.1 * 2 * Math.PI) / worldPixels)) * 180) / Math.PI,
  };
};
