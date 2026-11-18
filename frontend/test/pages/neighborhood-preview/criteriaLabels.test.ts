import { expect, it } from 'vitest';

import { formatRentPair } from '@/pages/neighborhood-preview/model/criteriaLabels';

it('월세 시세를 만원 단위 월세와 보증금으로 슬래시를 두고 적는다', () => {
  expect(formatRentPair({ monthlyRentKrw: 550_000, depositKrw: 30_000_000 })).toBe('55 / 3,000');
  expect(formatRentPair({ monthlyRentKrw: 680_000, depositKrw: 10_000_000 })).toBe('68 / 1,000');
});

it('만원 아래는 반올림하고 천 단위를 쉼표로 끊는다', () => {
  expect(formatRentPair({ monthlyRentKrw: 504_999, depositKrw: 123_456_789 })).toBe('50 / 12,346');
  expect(formatRentPair({ monthlyRentKrw: 0, depositKrw: 0 })).toBe('0 / 0');
});
