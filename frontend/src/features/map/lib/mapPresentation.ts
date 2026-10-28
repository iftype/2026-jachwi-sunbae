import type { MapCategory } from '../model/Map';

/** 지도 카테고리 레일 순서. 거리 메모를 가장 자주 켜서 맨 위에 둔다. */
export const MAP_CATEGORY_OPTIONS: Array<{ value: MapCategory; label: string; shortLabel: string }> = [
  { value: 'MEMO', label: '거리 메모', shortLabel: '메모' },
  { value: 'HOSPITAL', label: '병원', shortLabel: '병원' },
  { value: 'TRANSPORT', label: '교통', shortLabel: '교통' },
  { value: 'SCHOOL', label: '학교', shortLabel: '학교' },
  { value: 'CONVENIENCE', label: '편의점', shortLabel: '편의' },
  { value: 'AGENCY', label: '중개업소', shortLabel: '중개' },
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
