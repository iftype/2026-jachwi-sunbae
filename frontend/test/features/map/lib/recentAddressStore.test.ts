import { beforeEach, expect, it } from 'vitest';

import {
  addRecentAddress,
  clearRecentAddresses,
  readRecentAddresses,
  RECENT_ADDRESS_LIMIT,
  removeRecentAddress,
} from '@/features/map/lib/recentAddressStore';
import type { MapAddress } from '@/features/map/model/Map';

const address = (name: string): MapAddress => ({
  address: null,
  roadAddress: name,
  jibunAddress: null,
  latitude: 37.5,
  longitude: 127,
});

beforeEach(() => window.localStorage.clear());

it('같은 주소는 맨 위로 올리고 하나만 남긴다', () => {
  addRecentAddress(address('A'));
  addRecentAddress(address('B'));
  addRecentAddress(address('A'));
  expect(readRecentAddresses().map((saved) => saved.roadAddress)).toEqual(['A', 'B']);
});

it(`최대 ${RECENT_ADDRESS_LIMIT}개만 두고 오래된 것부터 버린다`, () => {
  for (let index = 0; index < RECENT_ADDRESS_LIMIT + 2; index += 1) addRecentAddress(address(`주소${index}`));
  const saved = readRecentAddresses();
  expect(saved).toHaveLength(RECENT_ADDRESS_LIMIT);
  expect(saved[0].roadAddress).toBe(`주소${RECENT_ADDRESS_LIMIT + 1}`);
});

it('하나 지우거나 모두 지운다', () => {
  addRecentAddress(address('A'));
  addRecentAddress(address('B'));
  expect(removeRecentAddress(address('A')).map((saved) => saved.roadAddress)).toEqual(['B']);
  expect(clearRecentAddresses()).toEqual([]);
  expect(readRecentAddresses()).toEqual([]);
});

it('깨진 저장 값은 기록이 없는 것으로 본다', () => {
  window.localStorage.setItem('jachwi-sunbae:recent-addresses', '{깨짐');
  expect(readRecentAddresses()).toEqual([]);
  window.localStorage.setItem('jachwi-sunbae:recent-addresses', JSON.stringify([{ latitude: 'x' }, address('A')]));
  expect(readRecentAddresses().map((saved) => saved.roadAddress)).toEqual(['A']);
});
