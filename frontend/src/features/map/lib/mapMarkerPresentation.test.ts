import { describe, expect, it } from 'vitest';

import type { MapMarker } from '../model/Map';
import { markerScale,PHOTO_MARKER_SCALE } from './mapMarkerPresentation';

const photoMarker: MapMarker = {
  id: 'record-1',
  latitude: 37.5,
  longitude: 127,
  label: '내 방',
  tone: 'property',
  photo: '/room.jpg',
};

describe('내 매물 사진 카드 마커 배율', () => {
  it('확대 단계가 바뀌어도 같은 배율을 쓴다', () => {
    const scales = [1, 3, 4, 5, 6, 8, 9, 12].map((level) => markerScale(photoMarker, level));

    expect(new Set(scales)).toEqual(new Set([PHOTO_MARKER_SCALE]));
  });

  it('묶음 마커도 같은 상수를 쓴다', () => {
    expect(markerScale({ ...photoMarker, tone: 'propertyCluster' }, 2)).toBe(PHOTO_MARKER_SCALE);
    expect(markerScale({ ...photoMarker, tone: 'propertyCluster' }, 10)).toBe(PHOTO_MARKER_SCALE);
  });

  it('사진이 없는 가게 마커는 확대 단계를 따라 배율이 바뀐다', () => {
    const place: MapMarker = { id: 'p', latitude: 37.5, longitude: 127, label: '가게', tone: 'place' };

    expect(markerScale(place, 1)).toBeGreaterThan(markerScale(place, 9));
  });
});
