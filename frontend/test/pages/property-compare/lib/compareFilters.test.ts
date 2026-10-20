import { describe, expect, it } from 'vitest';

import { DEFAULT_COMPARE_FILTERS, filterCompareProperties } from '@/pages/property-compare/lib/compareFilters';
import type { PropertySummary } from '@/features/property/model/Property';

const property = (propertyId: number, name: string, monthlyRentAmount: number, applied: boolean) =>
  ({
    propertyId,
    name,
    monthlyRentAmount,
    stages: [{ stage: 'ON_SITE', applied, progress: { completedCount: 0, totalCount: 4 } }],
  }) as unknown as PropertySummary;

const properties = [
  property(1, '신림 원룸', 450_000, true),
  property(2, '봉천 투룸', 800_000, false),
  property(3, '신림 오피스텔', 1_200_000, false),
];
const ids = (list: PropertySummary[]) => list.map((item) => item.propertyId);

describe('filterCompareProperties', () => {
  it('기본 필터는 모든 매물을 보여 준다', () => {
    expect(ids(filterCompareProperties(properties, DEFAULT_COMPARE_FILTERS))).toEqual([1, 2, 3]);
  });

  it('이름·월세 상한·체크리스트 시작 여부로 좁힌다', () => {
    expect(ids(filterCompareProperties(properties, { ...DEFAULT_COMPARE_FILTERS, query: ' 신림 ' }))).toEqual([1, 3]);
    expect(ids(filterCompareProperties(properties, { ...DEFAULT_COMPARE_FILTERS, rentLimit: 100 }))).toEqual([1, 2]);
    expect(ids(filterCompareProperties(properties, { ...DEFAULT_COMPARE_FILTERS, checklist: 'started' }))).toEqual([1]);
    expect(
      ids(filterCompareProperties(properties, { query: '신림', rentLimit: 100, checklist: 'notStarted' })),
    ).toEqual([]);
  });
});
