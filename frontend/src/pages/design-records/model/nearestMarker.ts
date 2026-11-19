import type { MapBounds, MapMarker } from '@/features/map/model/Map';

type Point = { latitude: number; longitude: number };

/** 화면 높이의 이 비율 안에 든 마커를 누른 것으로 본다(약 24px). */
const TAP_RADIUS_RATIO = 0.03;

/**
 * 칠해 둔 구역(찜한 동네)을 눌렀을 때, 그 자리 바로 아래 있는 기록과 메모 마커를 찾는다.
 * 구역이 마커보다 먼저 눌려도 마커의 말풍선이 뜨게 한다. 화면 범위를 모르거나 가까운 마커가 없으면 null이다.
 */
export const nearestMarkerAt = (markers: MapMarker[], point: Point, bounds: MapBounds | null): MapMarker | null => {
  if (bounds === null) return null;
  const radius = (bounds.north - bounds.south) * TAP_RADIUS_RATIO;
  let nearest: MapMarker | null = null;
  let nearestDistance = radius;
  for (const marker of markers) {
    const distance = Math.hypot(marker.latitude - point.latitude, marker.longitude - point.longitude);
    if (distance <= nearestDistance) {
      nearest = marker;
      nearestDistance = distance;
    }
  }
  return nearest;
};
