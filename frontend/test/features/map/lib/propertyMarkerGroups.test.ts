import { describe, expect, it } from 'vitest';

import {
  groupMemberIds,
  groupOverlappingMarkers,
  propertyGroupMarker,
  RECORD_GROUP_PREFIX,
} from '@/features/map/lib/propertyMarkerGroups';
import type { MapBounds, MapMarker } from '@/features/map/model/Map';

const marker = (id: string, latitude: number, longitude: number): MapMarker => ({
  id,
  latitude,
  longitude,
  label: id,
  tone: 'property',
});
const bounds: MapBounds = { south: 37, north: 38, west: 126, east: 127 };

describe('propertyMarkerGroups', () => {
  it('화면 범위를 모르면 좌표가 똑같은 매물만 묶는다', () => {
    const groups = groupOverlappingMarkers(
      [marker('a', 37.5, 127), marker('b', 37.5, 127), marker('c', 37.5001, 127)],
      null,
    );
    expect(groups.map((group) => group.map((item) => item.id))).toEqual([['a', 'b'], ['c']]);
  });

  it('화면 범위를 알면 핀이 포개질 만큼 가까운 매물을 함께 묶는다', () => {
    const near = groupOverlappingMarkers([marker('a', 37.5, 126.5), marker('b', 37.5001, 126.5001)], bounds);
    expect(near).toHaveLength(1);
    const far = groupOverlappingMarkers([marker('a', 37.1, 126.1), marker('b', 37.9, 126.9)], bounds);
    expect(far).toHaveLength(2);
  });

  it('하나뿐인 무리는 마커 그대로, 여럿이면 개수와 평균 좌표를 가진 묶음 마커가 된다', () => {
    const single = marker('a', 37.5, 127);
    expect(propertyGroupMarker([single])).toBe(single);
    const grouped = propertyGroupMarker([marker('a', 37, 126), marker('b', 38, 128)]);
    expect(grouped).toMatchObject({
      id: `${RECORD_GROUP_PREFIX}a,b`,
      latitude: 37.5,
      longitude: 127,
      tone: 'propertyCluster',
      count: 2,
      label: '매물 2개',
    });
  });

  it('묶음 마커 id에서 묶인 마커 id를 꺼내고, 묶음이 아니면 null이다', () => {
    expect(groupMemberIds(`${RECORD_GROUP_PREFIX}a,b,c`)).toEqual(['a', 'b', 'c']);
    expect(groupMemberIds('property-1')).toBeNull();
  });
});
