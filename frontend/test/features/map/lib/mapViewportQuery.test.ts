// @vitest-environment node
import { expect, it } from 'vitest';

import { distanceMeters, isInBounds, viewportQuery } from '@/features/map/lib/mapViewportQuery';

const around = (halfLatitude: number, halfLongitude: number) => ({
  south: 37.5 - halfLatitude,
  north: 37.5 + halfLatitude,
  west: 127 - halfLongitude,
  east: 127 + halfLongitude,
});

it('화면 가운데를 중심으로 모서리까지 덮는 가장 작은 지원 반경을 고른다', () => {
  // 모서리까지 약 300m, 630m, 1.3km
  expect(viewportQuery(around(0.002, 0.0025)).radius).toBe(500);
  expect(viewportQuery(around(0.004, 0.005)).radius).toBe(1000);
  expect(viewportQuery(around(0.008, 0.01)).radius).toBe(2000);
  expect(viewportQuery(around(0.004, 0.005)).center).toEqual({ latitude: 37.5, longitude: 127 });
});

it('화면이 2km보다 넓으면 가운데 2km만 요청한다', () => {
  expect(viewportQuery(around(0.05, 0.06)).radius).toBe(2000);
});

it('거리와 화면 포함 여부를 계산한다', () => {
  expect(distanceMeters({ latitude: 37.5, longitude: 127 }, { latitude: 37.509, longitude: 127 })).toBeCloseTo(
    1001,
    -1,
  );
  const bounds = around(0.004, 0.005);
  expect(isInBounds({ latitude: 37.5, longitude: 127.005 }, bounds)).toBe(true);
  expect(isInBounds({ latitude: 37.5, longitude: 127.0051 }, bounds)).toBe(false);
});
