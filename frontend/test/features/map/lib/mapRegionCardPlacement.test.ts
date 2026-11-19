import { expect, it } from 'vitest';

import { cardFlipsBelow, hoverCardFlipBelow } from '@/features/map/lib/mapRegionCardPlacement';

const view = { north: 37.6, south: 37.5, east: 127.1, west: 127.0 };
const size = { width: 1000, height: 800 };

it('위쪽 가장자리에 가까운 앵커의 카드는 아래로 뒤집고, 충분히 아래면 위에 둔다', () => {
  expect(cardFlipsBelow({ latitude: 37.595, longitude: 127.05 }, 12, view, 800)).toBe(true);
  expect(cardFlipsBelow({ latitude: 37.52, longitude: 127.05 }, 12, view, 800)).toBe(false);
  expect(cardFlipsBelow({ latitude: 37.595, longitude: 127.05 }, 12, view, 0)).toBe(false);
});

it('두 카드가 겹칠 만큼 가까우면 호버 카드를 고정 카드의 반대쪽으로 보낸다', () => {
  const pinned = { latitude: 37.55, longitude: 127.05 };
  const near = { latitude: 37.5505, longitude: 127.052 };
  expect(hoverCardFlipBelow(near, pinned, false, view, size)).toBe(true);
  expect(hoverCardFlipBelow(near, pinned, true, view, size)).toBe(false);
});

it('두 카드가 멀리 떨어져 있거나 화면 크기를 모르면 기본 방향을 쓴다', () => {
  const pinned = { latitude: 37.55, longitude: 127.05 };
  expect(hoverCardFlipBelow({ latitude: 37.55, longitude: 127.09 }, pinned, false, view, size)).toBeUndefined();
  expect(hoverCardFlipBelow({ latitude: 37.52, longitude: 127.05 }, pinned, false, view, size)).toBeUndefined();
  expect(hoverCardFlipBelow(pinned, pinned, false, view, { width: 0, height: 0 })).toBeUndefined();
});
