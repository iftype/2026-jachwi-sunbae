// @vitest-environment node
import { expect, it } from 'vitest';

import {
  FACILITY_CATEGORIES,
  FACILITY_CATEGORY_COLOR,
  getMapCategoryLabel,
  isFacilityCategory,
  MAP_CATEGORY_OPTIONS,
} from '@/features/map/lib/mapPresentation';
import { summarizeNearby } from '@/features/map/lib/nearbySummary';

it('시설 분류 막대와 요약이 같은 분류를 같은 순서로 쓴다', () => {
  expect(FACILITY_CATEGORIES).toEqual(['TRANSPORT', 'CONVENIENCE', 'HOSPITAL', 'AGENCY']);
  expect(summarizeNearby([], {}).map((item) => item.category)).toEqual([...FACILITY_CATEGORIES]);
  const railOrder = MAP_CATEGORY_OPTIONS.map((option) => option.value).filter(isFacilityCategory);
  expect(railOrder).toEqual([...FACILITY_CATEGORIES]);
});

it('시설 분류마다 이름과 색이 하나씩 정해져 있다', () => {
  expect(FACILITY_CATEGORIES.map(getMapCategoryLabel)).toEqual(['교통', '편의점', '병원', '중개업소']);
  const colors = FACILITY_CATEGORIES.map((category) => FACILITY_CATEGORY_COLOR[category]);
  expect(new Set(colors).size).toBe(FACILITY_CATEGORIES.length);
});
