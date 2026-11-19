// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  COORDINATE_ACTION_Z_INDEX,
  COORDINATE_MENU_Z_INDEX,
  markerScale,
  markerZIndex,
} from '@/features/map/lib/mapMarkerPresentation';
import type { MapMarker } from '@/features/map/model/Map';

const marker = (overrides: Partial<MapMarker>): MapMarker => ({
  id: 'marker',
  latitude: 37.5,
  longitude: 127,
  label: '마커',
  ...overrides,
});

it('거리 메모 말풍선은 골목 배율까지 그대로 두고, 멀리 축소할수록 줄이되 너무 작아지지는 않는다', () => {
  const memo = marker({ tone: 'destination', category: 'MEMO' });
  expect(markerScale(memo, 3)).toBe(1);
  expect(markerScale(memo, 4)).toBe(1);
  expect(markerScale(memo, 6)).toBe(0.8);
  expect(markerScale(memo, 8)).toBe(0.6);
  expect(markerScale(memo, 10)).toBe(0.6);
});

it('매물과 목적지 마커는 확대 단계에 맞춰 같은 비율로 커진다', () => {
  expect(markerScale(marker({ tone: 'property' }), 2)).toBe(1.35);
  expect(markerScale(marker({ tone: 'destination' }), 9)).toBe(0.6);
});

describe('markerZIndex', () => {
  it('순위 알약은 순위가 높을수록 앞에 둔다', () => {
    const ranks = [1, 2, 3, 4, 5].map((rank) => markerZIndex(marker({ id: `rank-${rank}`, tone: 'rank', rank }), null));
    expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
    expect(new Set(ranks).size).toBe(5);
  });

  it('같은 종류의 마커는 화면 아래(남쪽)에 있을수록 앞에 둔다', () => {
    const south = markerZIndex(marker({ id: 'south', tone: 'property', latitude: 37.49999 }), null);
    const north = markerZIndex(marker({ id: 'north', tone: 'property', latitude: 37.5 }), null);
    expect(south).toBeGreaterThan(north);
    expect(markerZIndex(marker({ tone: 'place', latitude: 33.1 }), null)).toBeGreaterThan(
      markerZIndex(marker({ tone: 'place', latitude: 38.6 }), null),
    );
  });

  it('세부 순서가 종류 간 순서를 뒤집지 않는다', () => {
    const order = [
      marker({ tone: 'selected', latitude: 90 }),
      marker({ tone: 'property', latitude: -90 }),
      marker({ tone: 'propertyCluster', latitude: 90 }),
      marker({ tone: 'current', latitude: -90 }),
      marker({ tone: 'rank', rank: 1 }),
      marker({ tone: 'rank', rank: 5, latitude: -90 }),
      marker({ tone: 'place', latitude: -90 }),
    ].map((item) => markerZIndex(item, null));
    // 매물(-90)과 매물 묶음(90)은 같은 종류라 위도로만 갈린다. 나머지는 위도가 가장 유리해도 윗 종류를 넘지 않는다.
    expect(order[0]).toBeGreaterThan(order[1]);
    expect(order[2]).toBeGreaterThan(order[3]);
    expect(order[3]).toBeGreaterThan(order[4]);
    expect(order[4]).toBeGreaterThan(order[5]);
    expect(order[5]).toBeGreaterThan(order[6]);
    expect(order[1]).toBeGreaterThan(order[2]);
  });

  it('지금 고른 마커와 flash는 어디 있든 맨 앞에 두고, 좌표 버튼과 메뉴는 그보다 앞에 둔다', () => {
    const southmostSelectedTone = markerZIndex(marker({ id: 'a', tone: 'selected', latitude: -90 }), null);
    const picked = markerZIndex(marker({ id: 'picked', tone: 'place', latitude: 90 }), 'picked');
    const flash = markerZIndex(marker({ id: 'flash', tone: 'flash', latitude: 90 }), 'picked');
    expect(picked).toBeGreaterThan(southmostSelectedTone);
    expect(flash).toBeGreaterThan(picked);
    expect(COORDINATE_ACTION_Z_INDEX).toBeGreaterThan(flash);
    expect(COORDINATE_MENU_Z_INDEX).toBeGreaterThan(COORDINATE_ACTION_Z_INDEX);
    expect(Number.isSafeInteger(COORDINATE_MENU_Z_INDEX) && COORDINATE_MENU_Z_INDEX < 2 ** 31).toBe(true);
  });
});

it.each(['property', 'propertyCluster', 'destination', 'place', 'rank'] as const)(
  '%s 마커는 확대할수록 단계마다 점점 커진다',
  (tone) => {
    const item = marker({ tone });
    expect([10, 8, 5, 3, 1].map((level) => markerScale(item, level))).toEqual([0.6, 0.8, 1.1, 1.35, 1.6]);
  },
);
