import { css } from '@emotion/css';

import Icon from '@/shared/ui/icon/Icon';

import type { NeighborhoodPreviewContext } from '../../hooks/useNeighborhoodPreview';
import { criteriaSummary } from '../../model/criteriaLabels';
import type { NeighborhoodFilterField } from '../../NeighborhoodFilters';

type Props = {
  preview: Pick<NeighborhoodPreviewContext, 'maxMinutes' | 'maxTransfers' | 'maxRent'>;
  onOpen: (field: NeighborhoodFilterField) => void;
};
const CriteriaSummary = ({ preview, onOpen }: Props) => (
  <div className={styles.card} aria-label={`선택한 탐색 조건 ${criteriaSummary(preview)}`}>
    <button type="button" onClick={() => onOpen('minutes')} aria-label={`통근 ${preview.maxMinutes}분 이내`}>
      <span>통근</span>
      <strong>{preview.maxMinutes}분</strong>
    </button>
    <button type="button" onClick={() => onOpen('transfers')} aria-label={`환승 ${preview.maxTransfers}회 이하`}>
      <span>환승</span>
      <strong>{preview.maxTransfers}회</strong>
    </button>
    <button
      type="button"
      onClick={() => onOpen('rent')}
      aria-label={`월세 ${preview.maxRent === 0 ? '전체' : `${preview.maxRent}만원`}, 눌러서 바꾸기`}
    >
      <span>월세</span>
      <strong className={styles.rent}>
        {preview.maxRent === 0 ? '전체' : `${preview.maxRent}만`}
        <Icon name="chevron-down" size={12} />
      </strong>
    </button>
  </div>
);
const styles = {
  card: css`
    label: CriteriaSummary-card;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    width: 100%;
    padding: 0.5rem 0.25rem;
    border-radius: var(--radius-card);
    background: var(--color-surface);
    box-shadow: var(--shadow-floating);
    pointer-events: auto;
    & button {
      min-width: 0;
      display: grid;
      justify-items: center;
      align-content: center;
      gap: 0.15rem;
      padding: 0;
      border: 0;
      background: transparent;
      font: inherit;
      color: var(--color-ink);
      cursor: pointer;
    }
    & button > span {
      font-size: 0.68rem;
      color: var(--color-muted);
      font-weight: 700;
    }
    & strong {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.15rem;
      min-height: 1.7rem;
      font-size: 1.1rem;
      font-weight: 800;
      white-space: nowrap;
    }
    & button:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
      border-radius: var(--radius-sm);
    }
  `,
  rent: css`
    label: CriteriaSummary-rent;
    border-radius: 1.5rem;
    padding: 0 0.35rem;
    background: color-mix(in srgb, var(--color-brand-blue-ink) 9%, var(--color-surface));
    color: var(--color-brand-blue-ink);
  `,
};
export default CriteriaSummary;
