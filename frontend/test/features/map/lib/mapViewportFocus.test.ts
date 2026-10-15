import { expect, it } from 'vitest';

import { getMapFocusCenter } from '@/features/map/lib/mapViewportFocus';

it('매물 좌표를 변경하지 않고 화면 중심을 남동쪽으로 이동해 매물이 왼쪽 위에 보이게 한다', () => {
  const coordinate = { latitude: 37.5, longitude: 127 };
  const center = getMapFocusCenter(coordinate, 4, 390, 700);
  expect(center.latitude).toBeLessThan(coordinate.latitude);
  expect(center.longitude).toBeGreaterThan(coordinate.longitude);
  expect(coordinate).toEqual({ latitude: 37.5, longitude: 127 });
  const closer = getMapFocusCenter(coordinate, 2, 390, 700);
  expect(Math.abs(closer.latitude - coordinate.latitude)).toBeLessThan(Math.abs(center.latitude - coordinate.latitude));
});
