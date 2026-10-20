import { WON_PER_MANWON } from '@/features/property/lib/propertyForm';
import type { PropertySummary } from '@/features/property/model/Property';

/** 월세 상한(만원). `null`이면 제한하지 않는다. */
export type RentLimit = 50 | 70 | 100 | null;
export type ChecklistFilter = 'all' | 'started' | 'notStarted';

export type CompareFilters = {
  query: string;
  rentLimit: RentLimit;
  checklist: ChecklistFilter;
};

export const DEFAULT_COMPARE_FILTERS: CompareFilters = { query: '', rentLimit: null, checklist: 'all' };

const hasStartedChecklist = (property: PropertySummary) => property.stages.some((stage) => stage.applied);

/** 비교 화면 오른쪽 필터로 매물 표에 보일 매물만 고른다. 고른 매물 선택 상태는 건드리지 않는다. */
export const filterCompareProperties = (properties: PropertySummary[], filters: CompareFilters) => {
  const query = filters.query.trim();
  return properties.filter((property) => {
    if (query !== '' && !property.name.includes(query)) return false;
    if (filters.rentLimit !== null && property.monthlyRentAmount > filters.rentLimit * WON_PER_MANWON) return false;
    if (filters.checklist === 'started' && !hasStartedChecklist(property)) return false;
    if (filters.checklist === 'notStarted' && hasStartedChecklist(property)) return false;
    return true;
  });
};
