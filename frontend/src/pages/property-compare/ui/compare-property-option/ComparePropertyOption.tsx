import { css, cx } from '@emotion/css';

import type { PropertySummary } from '@/features/property/model/Property';
import AuthenticatedPhoto from '@/features/property/ui/authenticated-photo/AuthenticatedPhoto';
import PropertyPlaceholderPhoto from '@/features/property/ui/property-placeholder-photo/PropertyPlaceholderPhoto';
import PropertyPrice from '@/features/property/ui/property-price/PropertyPrice';
import SelectionControl from '@/shared/ui/selection-control/SelectionControl';

type ComparePropertyOptionProps = {
  property: PropertySummary;
  isSelected: boolean;
  isDisabled: boolean;
  onToggle: () => void;
};

/** 적용된 체크리스트의 전체 진행률. 휴대폰과 데스크탑이 함께 쓴다. */
export const StageOverview = ({ property }: { property: PropertySummary }) => {
  const progress = property.stages
    .filter((stage) => stage.applied)
    .reduce(
      (total, stage) => ({
        completed: total.completed + stage.progress.completedCount,
        count: total.count + stage.progress.totalCount,
      }),
      { completed: 0, count: 0 },
    );
  return (
    <span className={styles.stageOverview} aria-label={`전체 ${progress.count}개 중 ${progress.completed}개 확인`}>
      {progress.completed}/{progress.count}
    </span>
  );
};

const ComparePropertyOption = ({ property, isSelected, isDisabled, onToggle }: ComparePropertyOptionProps) => (
  <SelectionControl
    className={styles.option}
    checked={isSelected}
    disabled={isDisabled}
    onSelect={onToggle}
    markClassName={styles.checkmark}
  >
    <span className={styles.thumbnail}>
      {property.representativePhoto === null ? (
        <PropertyPlaceholderPhoto className={styles.emptyThumbnailMascot} />
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
    <span className={styles.propertyInfo}>
      <strong>{property.name}</strong>
      <PropertyPrice
        depositAmount={property.depositAmount}
        monthlyRentAmount={property.monthlyRentAmount}
        variant="labeled"
      />
      {property.discoverySource.value.length > 0 && <span>발견 경로 · {property.discoverySource.value}</span>}
      <StageOverview property={property} />
    </span>
  </SelectionControl>
);

const styles = {
  // 다른 요소의 선택자에서 `.ComparePropertyOption-option`로 가리킨다.
  option: cx(
    css`
      label: ComparePropertyOption-option;
      display: grid;
      grid-template-columns: 1.1rem 3.8rem minmax(0, 1fr);
      align-items: center;
      gap: 0.7rem;
      min-height: 6.15rem;
      padding: 0.75rem 1rem;
      background: var(--color-canvas);
      cursor: pointer;
      transition: background-color 0.18s ease;

      /* 파란 띠와 바탕색, 체크 표시를 함께 써서 색 차이가 작아도 구분할 수 있게 한다. */
      &[data-selected='true'] {
        background: color-mix(in srgb, var(--color-brand-blue) 12%, var(--color-canvas));
        box-shadow: inset 3px 0 var(--color-brand-blue-ink);
      }

      &:has(input:focus-visible) {
        outline: 2px solid var(--color-focus);
        outline-offset: -2px;
      }

      &:has(input:disabled) {
        cursor: not-allowed;
        opacity: 0.58;
      }

      @media (max-width: 350px) {
        grid-template-columns: 1rem 3.2rem minmax(0, 1fr);
        gap: 0.55rem;
        padding-inline: 0.65rem;
      }
    `,
    'ComparePropertyOption-option',
  ),

  checkmark: css`
    label: ComparePropertyOption-checkmark;
    display: grid;
    flex: none;
    box-sizing: border-box;
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 50%;
    background: var(--color-border-strong);
    color: var(--color-on-primary);
    font-size: 0.7rem;
    font-weight: 800;
    line-height: 1;
    place-items: center;

    .ComparePropertyOption-option[data-selected='true'] & {
      background: var(--color-brand-blue-ink);
    }
  `,

  thumbnail: css`
    label: ComparePropertyOption-thumbnail;
    display: grid;
    width: 3.8rem;
    aspect-ratio: 1;
    overflow: hidden;
    border-radius: var(--radius-sm);
    background: var(--color-surface-disabled);
    color: var(--color-muted);
    place-items: center;

    & img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    @media (max-width: 350px) {
      width: 3.2rem;
    }
  `,

  emptyThumbnailMascot: css`
    label: ComparePropertyOption-emptyThumbnailMascot;
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
  `,

  // 다른 요소의 선택자에서 `.ComparePropertyOption-propertyInfo`로 가리킨다.
  propertyInfo: cx(
    css`
      label: ComparePropertyOption-propertyInfo;
      display: grid;
      min-width: 0;
      gap: 0.24rem;

      & > strong {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      & > strong {
        color: var(--color-ink);
        font-size: 0.8rem;
      }

      & > span {
        color: var(--color-muted);
        font-size: 0.58rem;
      }
    `,
    'ComparePropertyOption-propertyInfo',
  ),

  stageOverview: css`
    label: ComparePropertyOption-stageOverview;
    display: inline-block;
    color: var(--color-muted);
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
  `,
};

export default ComparePropertyOption;
