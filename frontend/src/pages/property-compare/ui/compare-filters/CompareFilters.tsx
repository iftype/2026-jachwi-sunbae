import { css } from '@emotion/css';

import type { ChecklistFilter, CompareFilters as Filters, RentLimit } from '../../lib/compareFilters';

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

/** 데스크탑 비교 화면에서 리스트 위 오른쪽에 두는 가로 필터. 월세 상한과 체크리스트 시작 여부로 매물 표를 좁힌다. */
const CompareFilters = ({ filters, resultCount, onChange }: CompareFiltersProps) => (
  <section className={styles.filters} aria-label="매물 필터">
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

const styles = {
  /* 리스트 위 줄 오른쪽에 두는 가로 필터 줄: 월세 칩, 체크리스트 칩, 결과 개수. */
  filters: css`
    label: CompareFilters-filters;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem 0.9rem;

    @media (max-width: 1023px) {
      display: grid;
      justify-content: stretch;
      gap: 0.65rem;
      padding: 0.75rem;
      border-radius: var(--radius-md);
      background: var(--color-surface-muted);
    }
  `,

  group: css`
    label: CompareFilters-group;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    border: 0;

    @media (max-width: 1023px) {
      display: grid;
      gap: 0.32rem;

      & legend {
        font-size: 0.75rem;
      }
    }

    & legend {
      float: left;
      margin-right: 0.4rem;
      padding: 0;
      color: var(--color-ink-soft);
      font-size: 0.62rem;
      font-weight: 600;
    }
  `,

  chips: css`
    label: CompareFilters-chips;
    display: flex;
    gap: 0.25rem;

    @media (max-width: 1023px) {
      flex-wrap: wrap;

      && button {
        min-height: 2.25rem;
        border-color: transparent;
        background: var(--color-surface);
        font-size: 0.75rem;
      }

      /* 테두리 없이 고른 칩을 구분하려고 진한 바탕에 흰 글자로 채운다. */
      && button[aria-pressed='true'] {
        border-color: transparent;
        background: var(--color-brand-blue-ink);
        color: var(--color-on-primary);
      }
    }

    /* 고른 칩은 파란 글자·옅은 파란 바탕, 나머지는 흰 칩으로 둔다. */
    & button {
      padding: 0.3rem 0.55rem;
      border: 1px solid #e3e5e9;
      border-radius: 0.5rem;
      background: #fff;
      color: var(--color-ink-soft);
      font: inherit;
      font-size: 0.62rem;
      cursor: pointer;
      transition:
        background-color 0.18s ease,
        border-color 0.18s ease,
        color 0.18s ease;
    }

    & button[aria-pressed='true'] {
      border-color: var(--color-brand-blue);
      background: color-mix(in srgb, var(--color-brand-blue) 10%, #fff);
      color: var(--color-brand-blue-ink);
      font-weight: 600;
    }
  `,

  count: css`
    label: CompareFilters-count;
    color: var(--color-ink-soft);
    font-size: 0.62rem;
  `,
};

export default CompareFilters;
