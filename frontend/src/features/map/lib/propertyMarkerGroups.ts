import { OVERLAP_HEIGHT_RATIO, OVERLAP_WIDTH_RATIO } from '@/features/street-memo/lib/streetMemoFocus';

import type { MapBounds, MapMarker } from '../model/Map';

/** 겹쳐 묶인 매물 마커 id의 머리. 뒤에 묶인 매물 마커 id를 쉼표로 잇는다. */
export const RECORD_GROUP_PREFIX = 'record-group:';

/**
 * 화면에서 집 핀이 포개질 만큼 가까운 매물 마커를 한 무리로 묶는다. 거리 메모 말풍선과 같은 겹침 간격을 쓴다.
 * 화면 범위를 모르면 좌표가 똑같은(같은 건물의) 매물만 묶는다.
 * 내 기록 지도와 동네 찾기 지도가 같은 기준으로 묶도록 함께 쓴다.
 */
export const groupOverlappingMarkers = (markers: MapMarker[], bounds: MapBounds | null): MapMarker[][] => {
  const latitudeGap = bounds ? (bounds.north - bounds.south) * OVERLAP_HEIGHT_RATIO : 0;
  const longitudeGap = bounds ? (bounds.east - bounds.west) * OVERLAP_WIDTH_RATIO : 0;
  const groups: MapMarker[][] = [];
  for (const marker of markers) {
    const group = groups.find(
      ([head]) =>
        Math.abs(head.latitude - marker.latitude) <= latitudeGap &&
        Math.abs(head.longitude - marker.longitude) <= longitudeGap,
    );
    if (group) group.push(marker);
    else groups.push([marker]);
  }
  return groups;
};

/** 한 무리를 마커 하나로 만든다. 하나뿐이면 그 마커 그대로이고, 여럿이면 사진 하나에 개수 배지를 단 묶음 마커다. */
export const propertyGroupMarker = (group: MapMarker[]): MapMarker =>
  group.length === 1
    ? group[0]
    : {
        id: `${RECORD_GROUP_PREFIX}${group.map((marker) => marker.id).join(',')}`,
        latitude: group.reduce((sum, marker) => sum + marker.latitude, 0) / group.length,
        longitude: group.reduce((sum, marker) => sum + marker.longitude, 0) / group.length,
        // 겹친 매물은 글 없이 사진만 올리고, 개수는 모서리의 배지가 보여 준다.
        label: `매물 ${group.length}개`,
        tone: 'propertyCluster',
        photo: group[0].photo,
        count: group.length,
        actionable: true,
      };

/** 묶음 마커 id에 담긴 마커 id들. 묶음이 아니면 null이다. */
export const groupMemberIds = (markerId: string): string[] | null =>
  markerId.startsWith(RECORD_GROUP_PREFIX) ? markerId.slice(RECORD_GROUP_PREFIX.length).split(',') : null;
