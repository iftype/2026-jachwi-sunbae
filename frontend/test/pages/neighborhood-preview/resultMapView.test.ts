// @vitest-environment node
import { expect, it } from 'vitest';

import { resultMapCenter } from '@/pages/neighborhood-preview/model/resultMapView';

it('지도 중심은 남쪽으로 옮겨 결과 위치가 중앙보다 위에 표시된다', () => {
  const point = { latitude: 37.5, longitude: 127 };
  expect(resultMapCenter(point, 7).latitude).toBeLessThan(point.latitude);
  expect(resultMapCenter(point, 7).longitude).toBe(point.longitude);
});
it('확대율이 달라도 동일한 픽셀 간격만큼 조정한다', () => {
  const point = { latitude: 37.5, longitude: 127 };
  const delta = (level: number) => {
    const y = (lat: number) => (1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2;
    return (y(resultMapCenter(point, level).latitude) - y(point.latitude)) * 256 * 2 ** (20 - level);
  };
  expect(delta(7)).toBeCloseTo(48);
  expect(delta(10)).toBeCloseTo(48);
});
