import { css } from '@emotion/css';

import type { RecordsMapLayers } from '../../hooks/useRecordsMapLayers';

type Props = { pick: NonNullable<RecordsMapLayers['locationPick']> };

const addressText = (pick: Props['pick']): string => {
  if (pick.status === 'idle') return '지도를 눌러 새 위치를 고르세요.';
  if (pick.status === 'geocoding') return '주소를 찾는 중이에요…';
  if (pick.status === 'error') return '이 자리의 주소를 찾지 못했어요. 다른 곳을 눌러 주세요.';
  if (pick.hasSaveFailed) return '저장하지 못했어요. 다시 눌러 주세요.';
  const { roadAddress, jibunAddress, address } = pick.address ?? {};
  return roadAddress ?? jibunAddress ?? address ?? '선택한 위치';
};

/** 매물 상세에서 주소를 바꾸는 동안 큰 지도 아래 가운데에 띄우는 안내. 지도를 눌러 자리를 고르고 여기서 저장하거나 취소한다. */
const RecordLocationPick = ({ pick }: Props) => (
  <div className={styles.toast} role="status">
    <span>{addressText(pick)}</span>
    <div className={styles.actions}>
      <button type="button" onClick={pick.cancel} disabled={pick.isSaving}>
        취소
      </button>
      {pick.status === 'ready' && (
        <button type="button" data-primary="true" onClick={pick.save} disabled={pick.isSaving}>
          {pick.isSaving ? '변경 중…' : '이 위치로 변경'}
        </button>
      )}
    </div>
  </div>
);

const styles = {
  toast: css`
    label: RecordLocationPick-toast;
    position: absolute;
    z-index: 35;
    bottom: calc(var(--map-sheet-bottom, 0px) + 1.5rem);
    left: calc(50% + var(--map-panel-width, 0px) / 2);
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.9rem;
    max-width: min(34rem, calc(100% - var(--map-panel-width, 0px) - 3rem));
    padding: 0.7rem 0.9rem 0.7rem 1.1rem;
    border-radius: 1rem;
    background: #fff;
    box-shadow: var(--shadow-floating);
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-ink);
  `,
  actions: css`
    label: RecordLocationPick-actions;
    display: flex;
    flex: none;
    gap: 0.4rem;

    & button {
      min-height: 2.1rem;
      padding: 0 0.9rem;
      border: 0;
      border-radius: 999px;
      background: var(--color-surface-muted);
      color: var(--color-ink);
      font: inherit;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
    }
    & button[data-primary='true'] {
      background: var(--color-brand-blue-ink);
      color: #fff;
    }
    & button:disabled {
      opacity: 0.6;
      cursor: default;
    }
  `,
};

export default RecordLocationPick;
