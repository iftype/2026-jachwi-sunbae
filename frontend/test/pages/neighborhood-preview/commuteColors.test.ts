import { expect, it } from 'vitest';

import { COMMUTE_COLORS, commuteColor } from '@/pages/neighborhood-preview/model/commuteColors';

it.each([
  [20, 'fast'],
  [21, 'medium'],
  [40, 'medium'],
  [41, 'slow'],
  [60, 'slow'],
] as const)('최대 60분일 때 %i분은 %s 구간이다', (minutes, group) => {
  expect(commuteColor(minutes, 60)).toEqual(COMMUTE_COLORS[group]);
});
it('사용자가 최대 시간을 바꾸면 색상 구간도 바뀐다', () => {
  expect(commuteColor(15, 60)).toEqual(COMMUTE_COLORS.fast);
  expect(commuteColor(15, 30)).toEqual(COMMUTE_COLORS.medium);
});
