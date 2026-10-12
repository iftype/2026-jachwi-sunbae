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
});
