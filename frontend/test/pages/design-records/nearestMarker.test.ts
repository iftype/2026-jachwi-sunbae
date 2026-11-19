import { expect, it } from 'vitest';

import { nearestMarkerAt } from '@/pages/design-records/model/nearestMarker';
import type { MapMarker } from '@/features/map/model/Map';

const bounds = { south: 37.0, north: 38.0, west: 126.5, east: 127.5 };
const marker = (id: string, latitude: number, longitude: number): MapMarker => ({ id, latitude, longitude, label: id });

it('구역을 누른 자리 바로 아래 있는 기록 마커를 찾는다', () => {
  const markers = [marker('far', 37.9, 127.4), marker('near', 37.501, 127.001)];
  expect(nearestMarkerAt(markers, { latitude: 37.5, longitude: 127 }, bounds)?.id).toBe('near');
});

it('가까운 마커가 없거나 화면 범위를 모르면 null이라 찜한 동네 카드를 연다', () => {
  const markers = [marker('far', 37.9, 127.4)];
  expect(nearestMarkerAt(markers, { latitude: 37.5, longitude: 127 }, bounds)).toBeNull();
  expect(nearestMarkerAt(markers, { latitude: 37.9, longitude: 127.4 }, null)).toBeNull();
});

it('여러 마커가 반경 안이면 가장 가까운 것을 고른다', () => {
  const markers = [marker('a', 37.51, 127.0), marker('b', 37.502, 127.0)];
  expect(nearestMarkerAt(markers, { latitude: 37.5, longitude: 127 }, bounds)?.id).toBe('b');
});
