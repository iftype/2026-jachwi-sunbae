import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import useMapProperties from '@/pages/map/hooks/useMapProperties';

const state = vi.hoisted(() => ({
  items: [
    {
      propertyId: 1,
      name: '이전 매물',
      depositAmount: 0,
      monthlyRentAmount: 0,
      location: { latitude: 37, longitude: 127 },
    },
  ],
}));
vi.mock('@/features/property/api/useProperties', () => ({
  usePropertyList: () => ({ data: { pages: [{ content: state.items }] } }),
}));
vi.mock('@/features/property/api/usePropertyPhotoObjectUrls', () => ({ usePropertyPhotoObjectUrls: () => ({}) }));
vi.mock('@/features/map/lib/mapClustering', () => ({ clusterProperties: () => [] }));

beforeEach(() => {
  state.items = [
    {
      propertyId: 1,
      name: '이전 매물',
      depositAmount: 0,
      monthlyRentAmount: 0,
      location: { latitude: 37, longitude: 127 },
    },
  ];
});

it('실제 지도 경계 안의 매물은 추정 범위를 벗어나도 표시하고 선택 매물은 개별 핀으로 유지한다', () => {
  state.items = [
    { ...state.items[0]!, propertyId: 1, location: { latitude: 37.1, longitude: 127.1 } },
    { ...state.items[0]!, propertyId: 2, location: { latitude: 37.3, longitude: 127.3 } },
  ];
  const { result, rerender } = renderHook(
    ({ north }) =>
      useMapProperties({ latitude: 37, longitude: 127 }, 4, { south: 37, west: 127, north, east: north + 90 }, 1),
    { initialProps: { north: 37.2 } },
  );
  expect(result.current.visibleProperties.map((property) => property.propertyId)).toEqual([1]);
  expect(result.current.propertyMarkers).toEqual([expect.objectContaining({ id: 'property-1', tone: 'property' })]);
  rerender({ north: 37.4 });
  expect(result.current.visibleProperties.map((property) => property.propertyId)).toEqual([1, 2]);
});

it('이전에 받은 대체 좌표 함수도 새 조회 결과와 빈 목록을 반영한다', () => {
  const { result, rerender } = renderHook(() => useMapProperties({ latitude: 37, longitude: 127 }, 4));
  const readFallback = result.current.getFallbackCoordinate;
  state.items = [{ ...state.items[0]!, name: '새 매물', location: { latitude: 38, longitude: 128 } }];
  rerender();
  expect(readFallback()).toEqual({ latitude: 38, longitude: 128, label: '새 매물' });
  state.items = [];
  rerender();
  expect(readFallback()).toBeUndefined();
});
