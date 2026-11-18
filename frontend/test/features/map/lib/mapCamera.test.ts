import { expect, it } from 'vitest';

import { centerWithInsets } from '@/features/map/lib/mapCamera';

it('좌우 패널의 차이만큼 지도 중심을 옮겨 선택 좌표가 비어 있는 영역에 보인다', () => {
  const point = { latitude: 37.5, longitude: 127 };
  const center = centerWithInsets(point, 6, { left: 800, right: 80, top: 100, bottom: 60 });
  expect(center.longitude).toBeLessThan(point.longitude);
  expect(center.latitude).toBeGreaterThan(point.latitude);
  expect(centerWithInsets(point, 6, { left: 80, right: 80, top: 40, bottom: 40 })).toEqual({
    latitude: expect.closeTo(point.latitude, 10),
    longitude: point.longitude,
  });
});
