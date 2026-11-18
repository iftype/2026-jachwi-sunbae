import type { MapCategory, NearbyPlace } from '../model/Map';

/**
 * `/api/maps/nearby`는 카테고리마다 가까운 순으로 최대 45곳(카카오 3쪽 x 15)까지만 준다.
 * 개수가 이 값이면 실제로는 더 있을 수 있어 `45곳 이상`으로 보여 준다. 가까운 순이라 가장 가까운 곳까지의 거리는 그대로 믿는다.
 */
export const NEARBY_CATEGORY_CAP = 45;

export type NearbyCategorySummary = {
  category: MapCategory;
  count: number;
  /** 서버가 자른 개수라 실제는 이보다 많을 수 있다. */
  capped: boolean;
  /** 가장 가까운 곳까지의 거리(m). 없으면 null. */
  nearestMeters: number | null;
};

/** 고리와 범례에 시설을 놓는 순서. */
export const SUMMARY_CATEGORIES: MapCategory[] = ['TRANSPORT', 'CONVENIENCE', 'HOSPITAL', 'SCHOOL', 'AGENCY'];

export const summarizeNearby = (
  places: NearbyPlace[],
  counts: Partial<Record<MapCategory, number>>,
): NearbyCategorySummary[] =>
  SUMMARY_CATEGORIES.map((category) => {
    const distances = places.filter((place) => place.category === category).map((place) => place.distanceMeters);
    const count = counts[category] ?? distances.length;
    return {
      category,
      count,
      // 정류장은 반경 안을 모두 주므로 자르지 않는다.
      capped: category !== 'TRANSPORT' && count >= NEARBY_CATEGORY_CAP,
      nearestMeters: distances.length ? Math.min(...distances) : null,
    };
  });
