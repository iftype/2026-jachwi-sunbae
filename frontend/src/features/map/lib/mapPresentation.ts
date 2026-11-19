import type { MapCategory } from '../model/Map';

/**
 * 시설 분류의 단일 정의. 지도 오른쪽 분류 막대와 매물 상세의 주변 시설 요약이 같은 순서, 이름, 색을 쓴다.
 * 순서는 교통, 편의점, 병원, 중개업소다.
 */
export const FACILITY_CATEGORIES = ['TRANSPORT', 'CONVENIENCE', 'HOSPITAL', 'AGENCY'] as const;
export type FacilityCategory = (typeof FACILITY_CATEGORIES)[number];

export const isFacilityCategory = (category: MapCategory): category is FacilityCategory =>
  FACILITY_CATEGORIES.some((facility) => facility === category);

/** 지도 점, 요약 고리 조각, 범례 점이 함께 쓰는 시설별 색. */
export const FACILITY_CATEGORY_COLOR: Record<FacilityCategory, string> = {
  TRANSPORT: '#3b82f6',
  CONVENIENCE: '#22c55e',
  HOSPITAL: '#ef4444',
  AGENCY: '#f59e0b',
};

/**
 * 지도 카테고리 레일 순서. 거리 메모를 가장 자주 켜서 맨 위에 두고, 시설은 {@link FACILITY_CATEGORIES} 순서를 따른다.
 * `shortLabel`은 칸이 좁은 레일에서 쓰는 글자다. 중개업소만 한 줄에 들어가도록 `중개사`로 줄인다.
 */
export const MAP_CATEGORY_OPTIONS: Array<{ value: MapCategory; label: string; shortLabel: string }> = [
  { value: 'MEMO', label: '거리 메모', shortLabel: '메모' },
  { value: 'TRANSPORT', label: '교통', shortLabel: '교통' },
  { value: 'CONVENIENCE', label: '편의점', shortLabel: '편의점' },
  { value: 'HOSPITAL', label: '병원', shortLabel: '병원' },
  { value: 'SCHOOL', label: '학교', shortLabel: '학교' },
  { value: 'AGENCY', label: '중개업소', shortLabel: '중개사' },
];

/** 주변 시설 카테고리. 거리 메모는 시설이 아니라 주변 분석에서 뺀다. */
export const ALL_MAP_CATEGORIES = MAP_CATEGORY_OPTIONS.map((option) => option.value).filter(
  (category) => category !== 'MEMO',
);

/** 지도 시설 필터는 한 번에 한 카테고리만 켠다. 켜져 있는 카테고리를 다시 누르면 끈다. */
export const selectSingleCategory = (categories: MapCategory[], category: MapCategory): MapCategory[] =>
  categories.includes(category) ? [] : [category];

export const getMapCategoryLabel = (category: MapCategory): string =>
  MAP_CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? category;
