import TextField from '@/shared/ui/text-field/TextField';

import type { ChecklistFilter, CompareFilters as Filters, RentLimit } from '../../lib/compareFilters';

import styles from './CompareFilters.module.css';

const RENT_OPTIONS: Array<{ label: string; value: RentLimit }> = [
  { label: '전체', value: null },
  { label: '50만 이하', value: 50 },
  { label: '70만 이하', value: 70 },
  { label: '100만 이하', value: 100 },
];

const CHECKLIST_OPTIONS: Array<{ label: string; value: ChecklistFilter }> = [
  { label: '전체', value: 'all' },
  { label: '시작함', value: 'started' },
  { label: '시작 전', value: 'notStarted' },
];

type CompareFiltersProps = {
  filters: Filters;
  resultCount: number;
  onChange: (filters: Filters) => void;
};

/** 데스크탑 비교 화면에서 리스트 위 오른쪽에 두는 가로 필터. 이름·월세 상한·체크리스트 시작 여부로 매물 표를 좁힌다. */
const CompareFilters = ({ filters, resultCount, onChange }: CompareFiltersProps) => (
  <section className={styles.filters} aria-label="매물 필터">
    <TextField
      fieldClassName={styles.search}
      label="매물 이름"
      placeholder="이름으로 찾기"
      value={filters.query}
      onChange={(event) => onChange({ ...filters, query: event.target.value })}
    />
    <fieldset className={styles.group}>
      <legend>월세</legend>
      <div className={styles.chips}>
        {RENT_OPTIONS.map((option) => (
          <button
            key={option.label}
            type="button"
            aria-pressed={filters.rentLimit === option.value}
            onClick={() => onChange({ ...filters, rentLimit: option.value })}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
    <fieldset className={styles.group}>
      <legend>체크리스트</legend>
      <div className={styles.chips}>
        {CHECKLIST_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={filters.checklist === option.value}
            onClick={() => onChange({ ...filters, checklist: option.value })}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
    <span className={styles.count} aria-live="polite">
      {resultCount}개 매물
    </span>
  </section>
);

export default CompareFilters;
