import { css, cx } from '@emotion/css';

import type { PropertySummary } from '@/features/property/model/Property';
import AuthenticatedPhoto from '@/features/property/ui/authenticated-photo/AuthenticatedPhoto';
import PropertyPlaceholderPhoto from '@/features/property/ui/property-placeholder-photo/PropertyPlaceholderPhoto';
import PropertyPrice from '@/features/property/ui/property-price/PropertyPrice';
import SelectionControl from '@/shared/ui/selection-control/SelectionControl';

import { StageOverview } from '../compare-property-option/ComparePropertyOption';

type CompareTableProps = {
  properties: PropertySummary[];
  selectedIds: number[];
  maxSelection: number;
  onToggle: (propertyId: number) => void;
};

/**
 * 데스크탑 비교 표. 관리 화면 표처럼 회색 머리글 줄과 짝수 줄 줄무늬를 두고,
 * 한 줄에 체크·사진·매물 이름·보증금/월세·발견 경로·체크 진행을 나란히 놓는다.
 */
const CompareTable = ({ properties, selectedIds, maxSelection, onToggle }: CompareTableProps) => (
  <div className={styles.table}>
    {/* 각 칸 이름은 줄 안의 값으로도 읽히므로 화면 낭독기에서는 머리글 줄을 숨긴다. */}
    <div className={styles.header} aria-hidden="true">
      <span />
      <span />
      <span>매물</span>
      <span>보증금 / 월세</span>
      <span>발견 경로</span>
      <span>체크 진행</span>
    </div>
    <ul className={styles.rows} aria-label="비교할 매물 목록">
      {properties.length === 0 && <li className={styles.noResult}>조건에 맞는 매물이 없어요.</li>}
      {properties.map((property) => {
        const isSelected = selectedIds.includes(property.propertyId);
        return (
          <li key={property.propertyId}>
            <SelectionControl
              className={styles.row}
              checked={isSelected}
              disabled={!isSelected && selectedIds.length >= maxSelection}
              onSelect={() => onToggle(property.propertyId)}
              markClassName={styles.checkmark}
            >
              <span className={styles.thumbnail}>
                {property.representativePhoto === null ? (
                  <PropertyPlaceholderPhoto />
                ) : (
                  <AuthenticatedPhoto
                    propertyId={property.propertyId}
                    photoId={property.representativePhoto.photoId}
                    kind="thumbnail"
                    contentUrl={property.representativePhoto.thumbnailUrl}
                    alt=""
                  />
                )}
              </span>
              <strong className={styles.cell}>{property.name}</strong>
              <PropertyPrice
                className={styles.cell}
                depositAmount={property.depositAmount}
                monthlyRentAmount={property.monthlyRentAmount}
                variant="plain"
              />
              <span className={styles.cell}>{property.discoverySource.value || '—'}</span>
              <StageOverview property={property} />
            </SelectionControl>
          </li>
        );
      })}
    </ul>
  </div>
);

const styles = {
  table: css`
    label: CompareTable-table;
    --compare-table-columns: 1.1rem 2.5rem minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.3fr);
    display: grid;
    overflow: hidden;
    border-radius: var(--radius-md);
    background: #fff;
  `,

  header: css`
    label: CompareTable-header;
    display: grid;
    grid-template-columns: var(--compare-table-columns);
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 1rem;
    padding-block: 0.5rem;
    background: #f3f4f7;
    color: var(--color-muted);
    font-size: 0.66rem;
    font-weight: 600;
  `,

  // 다른 요소의 선택자에서 `.CompareTable-row`로 가리킨다.
  row: cx(
    css`
      label: CompareTable-row;
      display: grid;
      grid-template-columns: var(--compare-table-columns);
      align-items: center;
      gap: 0.75rem;
      padding: 0.35rem 1rem;
      min-height: 2.75rem;
      cursor: pointer;
      transition: background-color 0.18s ease;

      /* 선택한 줄은 옅은 파란 바탕으로 표시한다. */
      &[data-selected='true'] {
        background: color-mix(in srgb, var(--color-brand-blue) 10%, transparent);
      }

      &:has(input:focus-visible) {
        outline: 2px solid var(--color-focus);
        outline-offset: -2px;
      }

      &:has(input:disabled) {
        cursor: not-allowed;
        opacity: 0.58;
      }
    `,
    'CompareTable-row',
  ),

  rows: css`
    label: CompareTable-rows;
    margin: 0;
    padding: 0;
    list-style: none;

    & > li:nth-child(even) {
      background: #f9fafb;
    }
  `,

  checkmark: css`
    label: CompareTable-checkmark;
    display: grid;
    flex: none;
    box-sizing: border-box;
    width: 1.1rem;
    height: 1.1rem;
    border: 1px solid var(--color-border-strong);
    border-radius: 50%;
    background: #fff;
    color: var(--color-on-primary);
    font-size: 0.7rem;
    font-weight: 800;
    line-height: 1;
    place-items: center;

    .CompareTable-row[data-selected='true'] & {
      border-color: var(--color-brand-blue);
      background: var(--color-brand-blue);
    }
  `,

  thumbnail: css`
    label: CompareTable-thumbnail;
    display: grid;
    width: 2rem;
    aspect-ratio: 1;
    overflow: hidden;
    border-radius: var(--radius-sm);
    background: var(--color-surface-disabled);
    place-items: center;

    & img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,

  cell: css`
    label: CompareTable-cell;
    overflow: hidden;
    color: var(--color-muted);
    font-size: 0.72rem;
    text-overflow: ellipsis;
    white-space: nowrap;

    strong& {
      color: var(--color-ink);
      font-weight: 600;
    }
  `,

  noResult: css`
    label: CompareTable-noResult;
    padding: 1.5rem 1rem;
    color: var(--color-muted);
    font-size: 0.72rem;
    text-align: center;
  `,
};

export default CompareTable;
