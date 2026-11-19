// @vitest-environment node
import { expect, it } from 'vitest';

import { regionCardCode } from '@/pages/neighborhood-preview/model/regionCardCode';

it('누른 동네가 있으면 다른 동네에 마우스를 올려도 그 동네 카드를 그대로 둔다', () => {
  expect(regionCardCode('A', 'B')).toBe('A');
  expect(regionCardCode('A', null)).toBe('A');
});

it('누른 동네가 없으면 마우스를 올린 동네 카드를 보인다', () => {
  expect(regionCardCode(null, 'B')).toBe('B');
  expect(regionCardCode(null, null)).toBeNull();
});

it('다른 동네를 눌러 고정이 옮겨 가면 새 동네 카드가 남는다', () => {
  expect(regionCardCode('A', 'B')).toBe('A');
  expect(regionCardCode('B', 'B')).toBe('B');
});
