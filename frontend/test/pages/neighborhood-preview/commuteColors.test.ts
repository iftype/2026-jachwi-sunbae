import { expect, it } from 'vitest';

import { COMMUTE_COLORS, commuteColor, commuteLegend } from '@/pages/neighborhood-preview/model/commuteColors';

it.each([
  [1, 'fast'],
  [15, 'fast'],
  [16, 'medium'],
  [30, 'medium'],
  [31, 'slow'],
  [60, 'slow'],
] as const)('%i분은 최대 시간과 상관없이 %s 구간이다', (minutes, group) => {
  expect(commuteColor(minutes)).toEqual(COMMUTE_COLORS[group]);
});
it.each([
  [10, [['fast', '10분 이하']]],
  [
    20,
    [
      ['fast', '15분 이하'],
      ['medium', '16~20분'],
    ],
  ],
  [
    30,
    [
      ['fast', '15분 이하'],
      ['medium', '16~30분'],
    ],
  ],
  [
    60,
    [
      ['fast', '15분 이하'],
      ['medium', '16~30분'],
      ['slow', '31~60분'],
    ],
  ],
] as const)('최대 %i분이면 들어오는 구간만 범례에 보인다', (maxMinutes, rows) => {
  expect(commuteLegend(maxMinutes)).toEqual(rows);
});
