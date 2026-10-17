// @vitest-environment node
import { expect, it } from 'vitest';

import { type MapViewState, readMapView, writeMapView } from '@/pages/map/lib/mapViewState';

it('원래 방문 기록과 상세의 복귀 상태 양쪽에서 같은 지도 상태를 복원한다', () => {
  const view: MapViewState = {
    center: { latitude: 37.5, longitude: 127.1 },
    level: 7,
    selectedPropertyId: 10,
    nearbyAnchor: { latitude: 37.49, longitude: 127.09 },
    hasNearbyAnchor: true,
    radius: 2000,
    categories: ['HOSPITAL'],
    sheetStage: 'mid',
  };
  writeMapView('original-map', view);
  expect(readMapView('original-map', null)).toEqual(view);
  expect(readMapView('new-return-entry', { mapViewKey: 'original-map' })).toEqual(view);
  expect(readMapView('fresh-entry', null)).toBeUndefined();
  // 복귀 상태가 문자열이거나 키가 문자열이 아니면 방문 기록 키로 읽는다.
  expect(readMapView('fresh-entry', 'original-map')).toBeUndefined();
  expect(readMapView('original-map', { mapViewKey: 123 })).toEqual(view);
  expect(readMapView('original-map', { other: 'original-map' })).toEqual(view);
});

it('최근 20개 방문 기록만 보관하고 가장 오래된 것부터 지운다', () => {
  const view: MapViewState = {
    center: { latitude: 37.5, longitude: 127.1 },
    level: 7,
    selectedPropertyId: null,
    nearbyAnchor: { latitude: 37.5, longitude: 127.1 },
    hasNearbyAnchor: false,
    radius: null,
    categories: [],
    sheetStage: 'closed',
  };
  for (let index = 0; index < 25; index += 1) {
    writeMapView(`evict-${index}`, { ...view, level: index });
  }
  expect(readMapView('evict-5', null)).toEqual({ ...view, level: 5 });
  expect(readMapView('evict-24', null)).toEqual({ ...view, level: 24 });
  expect(readMapView('evict-4', null)).toBeUndefined();
});
