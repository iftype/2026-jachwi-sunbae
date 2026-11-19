import { expect, it } from 'vitest';

import { cardFlipsBelow } from '@/features/map/lib/mapRegionCardPlacement';

const view = { north: 37.6, south: 37.5, east: 127.1, west: 127.0 };

it('위쪽 가장자리에 가까운 앵커의 카드는 아래로 뒤집고, 충분히 아래면 위에 둔다', () => {
  expect(cardFlipsBelow({ latitude: 37.595, longitude: 127.05 }, 12, view, 800)).toBe(true);
  expect(cardFlipsBelow({ latitude: 37.52, longitude: 127.05 }, 12, view, 800)).toBe(false);
  expect(cardFlipsBelow({ latitude: 37.595, longitude: 127.05 }, 12, view, 0)).toBe(false);
});
