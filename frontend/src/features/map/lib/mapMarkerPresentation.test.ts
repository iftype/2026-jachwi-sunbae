import { describe, expect, it } from 'vitest';

import type { MapMarker } from '../model/Map';
import { markerScale, PHOTO_MARKER_MAX_SCALE, PHOTO_MARKER_MIN_SCALE } from './mapMarkerPresentation';

const photoMarker: MapMarker = {
  id: 'record-1',
  latitude: 37.5,
  longitude: 127,
  label: '내 방',
  tone: 'property',
  photo: '/room.jpg',
};

describe('내 매물 사진 카드 마커 배율', () => {
  it('멀리 축소할수록 작아진다', () => {
    expect(markerScale(photoMarker, 6)).toBeLessThan(markerScale(photoMarker, 4));
    expect(markerScale(photoMarker, 8)).toBeLessThan(markerScale(photoMarker, 6));
  });

  it('가까이 확대해도 가장 큰 배율보다 커지지 않는다', () => {
    const scales = [1, 2, 3, 4].map((level) => markerScale(photoMarker, level));

    expect(new Set(scales)).toEqual(new Set([PHOTO_MARKER_MAX_SCALE]));
  });

  it('아주 멀리 축소해도 가장 작은 배율 아래로 줄지 않는다', () => {
    expect(markerScale(photoMarker, 12)).toBe(PHOTO_MARKER_MIN_SCALE);
    expect(markerScale(photoMarker, 14)).toBe(PHOTO_MARKER_MIN_SCALE);
  });

  it('묶음 마커도 같은 배율을 쓴다', () => {
    const cluster: MapMarker = { ...photoMarker, tone: 'propertyCluster' };

    expect(markerScale(cluster, 2)).toBe(markerScale(photoMarker, 2));
    expect(markerScale(cluster, 7)).toBe(markerScale(photoMarker, 7));
  });

  it('사진이 없는 가게 마커는 확대 단계를 따라 배율이 바뀐다', () => {
    const place: MapMarker = { id: 'p', latitude: 37.5, longitude: 127, label: '가게', tone: 'place' };

    expect(markerScale(place, 1)).toBeGreaterThan(markerScale(place, 9));
  });
});
