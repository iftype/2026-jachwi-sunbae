import { css } from '@emotion/css';
import type { ReactNode } from 'react';

import { Button } from '@/shared/ui/button/Button';
import { SegmentedControl, SegmentedControlItem } from '@/shared/ui/segmented-control/SegmentedControl';

import type { NeighborhoodPreviewContext } from '../../hooks/useNeighborhoodPreview';
import { MINUTE_OPTIONS } from '../../NeighborhoodFilters';
import CommuteDestinationField from '../commute-destination-field/CommuteDestinationField';
import RentSlider from '../rent-slider/RentSlider';

type ConditionPanelProps = {
  preview: Pick<
    NeighborhoodPreviewContext,
    | 'hasChosenMapPoint'
    | 'mapCandidate'
    | 'isSearching'
    | 'searchError'
    | 'addressResults'
    | 'selectAddress'
    | 'editLocation'
    | 'query'
    | 'changeQuery'
    | 'searchDestination'
    | 'openMapSearch'
    | 'isMapSelectionEnabled'
    | 'openMapSelection'
    | 'cancelMapSelection'
    | 'maxMinutes'
    | 'changeMaxMinutes'
    | 'maxTransfers'
    | 'changeMaxTransfers'
    | 'isValidCommuteTime'
    | 'maxRent'
    | 'changeMaxRent'
  >;
  disabled: boolean;
  onSubmit: () => void;
  includeRent?: boolean;
  canSubmit?: boolean;
  /** false면 찾기 버튼과 옆 버튼 줄을 통째로 숨긴다. 바뀐 조건이 없을 때 쓴다. */
  showActions?: boolean;
  submitLabel?: string;
  /** 찾기 버튼 옆에 같은 크기로 나란히 두는 버튼(취소 등). */
  secondaryAction?: ReactNode;
  /** 제목 줄 오른쪽 끝에 두는 버튼(접기 등). 제목과 같은 줄, 같은 높이에 맞춘다. */
  headerAction?: ReactNode;
};

/**
 * 데스크탑 동네 찾기의 왼쪽 칸. 휴대폰은 지도 아래 카드의 조건 칸을 눌러 휠로 고르지만,
 * 데스크탑은 본 방 기록처럼 왼쪽 칸에 출퇴근 장소·조건·찾기 버튼을 펼쳐 두고 지도는 위치를 찍는 데만 쓴다.
 * 월세 시세는 찾기 전에 고르지 않는다. 결과 지도 위 슬라이더에서 언제든 바꿔 가며 바로 본다.
 */
const ConditionPanel = ({
  preview,
  disabled,
  onSubmit,
  includeRent = false,
  canSubmit = true,
  showActions = true,
  submitLabel = '이 조건으로 동네 찾기',
  secondaryAction,
  headerAction,
}: ConditionPanelProps) => {
  return (
    <aside className={styles.panel} aria-label="탐색 조건">
      <header className={styles.header}>
        <h2>어디로 출퇴근하세요?</h2>
        {headerAction}
      </header>
      <CommuteDestinationField preview={preview} disabled={disabled} />
      <fieldset className={styles.field} disabled={disabled}>
        <legend>통근 시간</legend>
        <SegmentedControl
          aria-label="최대 통근 시간"
          value={String(preview.maxMinutes)}
          onValueChange={(value) => preview.changeMaxMinutes(Number(value))}
        >
          {MINUTE_OPTIONS.map((option) => (
            <SegmentedControlItem key={option.value} value={String(option.value)}>
              {option.value}분
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </fieldset>
      <fieldset className={styles.field} disabled={disabled}>
        <legend>환승 횟수</legend>
        <SegmentedControl
          aria-label="최대 환승 횟수"
          value={String(preview.maxTransfers)}
          onValueChange={(value) => preview.changeMaxTransfers(Number(value))}
        >
          {[0, 1, 2].map((count) => (
            <SegmentedControlItem key={count} value={String(count)}>
              {count === 0 ? '환승 없음' : `${count}회 이하`}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </fieldset>
      {includeRent && (
        <fieldset className={styles.field} disabled={disabled}>
          <legend className="sr-only">월세 조건</legend>
          <RentSlider preview={preview} compact />
        </fieldset>
      )}
      {showActions && (
        <div className={styles.actions} data-paired={secondaryAction ? 'true' : undefined}>
          <Button
            className={styles.submit}
            fullWidth
            disabled={disabled || !canSubmit || !preview.hasChosenMapPoint || !preview.isValidCommuteTime}
            onClick={onSubmit}
          >
            {submitLabel}
          </Button>
          {secondaryAction}
        </div>
      )}
    </aside>
  );
};

const styles = {
  /* 제목과 접기 버튼을 한 줄에 두고 세로 가운데를 맞춘다. */
  header: css`
    label: ConditionPanel-header;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    min-height: 2.25rem;
  `,
  placeText: css`
    label: ConditionPanel-placeText;
    display: grid;
    gap: 0.25rem;
    min-width: 0;
  `,
  change: css`
    label: ConditionPanel-change;
    flex: none;
    min-height: 2rem;
    padding: 0 0.85rem;
    border: 0;
    border-radius: 999px;
    background: white;
    color: var(--color-brand-blue-ink);
    font: inherit;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;

    &:disabled {
      opacity: 0.5;
      cursor: default;
    }
  `,
  /* 찾기와 취소를 1:1로 나란히 둔다. 취소가 없으면 찾기 버튼이 한 줄을 다 쓴다. */
  actions: css`
    label: ConditionPanel-actions;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.5rem;

    &[data-paired='true'] {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  `,

  panel: css`
    label: ConditionPanel-panel;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    min-height: 0;
    overflow-y: auto;
    padding: 1rem 1.25rem 1.15rem;
    background: white;

    & h2 {
      margin: 0;
      font-size: 1rem;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
  `,

  place: css`
    label: ConditionPanel-place;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.7rem 0.9rem;
    border-radius: 0.7rem;
    background: var(--color-card-surface);

    & small {
      color: var(--color-muted);
      font-size: 0.75rem;
    }

    & strong {
      font-size: 0.95rem;
    }

    & p {
      margin: 0;
      color: var(--color-ink-soft);
      font-size: 0.85rem;
      line-height: 1.5;
    }
  `,

  field: css`
    label: ConditionPanel-field;
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    border: 0;

    & legend {
      margin-bottom: 0.5rem;
      padding: 0;
      font-size: 0.85rem;
      font-weight: 700;
    }

    & small {
      color: var(--color-muted);
      font-size: 0.75rem;
    }
  `,

  /* 조건을 고른 흐름이 끊기지 않게 마지막 조건 바로 아래에 둔다. */
  submit: css`
    label: ConditionPanel-submit;
    margin-top: 0.25rem;
  `,
};

export default ConditionPanel;
