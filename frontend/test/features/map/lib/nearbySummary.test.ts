// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { NEARBY_CATEGORY_CAP, summarizeNearby } from '@/features/map/lib/nearbySummary';
import type { MapCategory, NearbyPlace } from '@/features/map/model/Map';

const place = (category: MapCategory, distanceMeters: number): NearbyPlace => ({
  providerPlaceId: `${category}-${distanceMeters}`,
  name: `${category} ${distanceMeters}m`,
  category,
  address: '서울 관악구',
  latitude: 37.48,
  longitude: 126.93,
  distanceMeters,
});

describe('매물 주변 시설 요약', () => {
  it('정해 둔 순서로 시설마다 개수와 가장 가까운 거리를 낸다', () => {
    const summary = summarizeNearby([place('CONVENIENCE', 320), place('CONVENIENCE', 80), place('TRANSPORT', 140)], {
      CONVENIENCE: 2,
      TRANSPORT: 1,
    });

    expect(summary.map((item) => item.category)).toEqual(['TRANSPORT', 'CONVENIENCE', 'HOSPITAL', 'AGENCY']);
    expect(summary[0]).toEqual({ category: 'TRANSPORT', count: 1, capped: false, nearestMeters: 140 });
    expect(summary[1]).toEqual({ category: 'CONVENIENCE', count: 2, capped: false, nearestMeters: 80 });
    expect(summary[2]).toEqual({ category: 'HOSPITAL', count: 0, capped: false, nearestMeters: null });
  });

  it('서버가 준 개수를 먼저 쓰고, 없으면 받은 장소 수로 센다', () => {
    const summary = summarizeNearby([place('HOSPITAL', 200), place('AGENCY', 400)], { HOSPITAL: 7 });

    expect(summary.find((item) => item.category === 'HOSPITAL')?.count).toBe(7);
    expect(summary.find((item) => item.category === 'AGENCY')?.count).toBe(1);
  });

  it('잘린 개수에 이른 시설은 더 있을 수 있다고 표시하되, 정류장은 자르지 않는다', () => {
    const summary = summarizeNearby([], { CONVENIENCE: NEARBY_CATEGORY_CAP, TRANSPORT: 60, AGENCY: 44 });

    expect(summary.find((item) => item.category === 'CONVENIENCE')?.capped).toBe(true);
    expect(summary.find((item) => item.category === 'TRANSPORT')?.capped).toBe(false);
    expect(summary.find((item) => item.category === 'AGENCY')?.capped).toBe(false);
  });
});
