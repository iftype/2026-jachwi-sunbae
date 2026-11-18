import { css } from '@emotion/css';

import Icon from '@/shared/ui/icon/Icon';

type Props = {
  /** 동네 추천받기 모드가 켜져 있는지. 켜면 지도를 한 번 눌러 그 자리로 동네를 추천받는다. */
  isActive: boolean;
  onToggle: () => void;
};

/** 지도 왼쪽 아래의 `동네 추천받기` 버튼. 켜 두고 지도를 누르면 그 위치를 기준으로 동네 찾기를 연다. */
const RecordRecommendButton = ({ isActive, onToggle }: Props) => (
  <>
    <button className={styles.button} type="button" aria-pressed={isActive} onClick={onToggle}>
      <Icon name={isActive ? 'close' : 'target'} size={18} />
      {isActive ? '추천 취소' : '동네 추천받기'}
    </button>
    {isActive && (
      <p className={styles.hint} role="status">
        추천받을 위치를 지도에서 눌러 주세요.
      </p>
    )}
  </>
);

const styles = {
  button: css`
    label: RecordRecommendButton-button;
    position: absolute;
    z-index: 12;
    left: 1rem;
    bottom: 1.25rem;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-height: 2.65rem;
    padding: 0 1rem;
    border: 0;
    border-radius: 999px;
    color: #41444b;
    background: #fff;
    box-shadow: 0 2px 10px #00000016;
    font: inherit;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;

    &[aria-pressed='true'] {
      color: #fff;
      background: var(--color-brand-blue-ink, #2457d6);
    }

    [data-desktop='false'] & {
      bottom: calc(5.5rem + env(safe-area-inset-bottom));
    }
  `,
  hint: css`
    label: RecordRecommendButton-hint;
    position: absolute;
    z-index: 12;
    left: 50%;
    top: 7rem;
    transform: translateX(-50%);
    margin: 0;
    padding: 0.55rem 0.9rem;
    border-radius: 999px;
    color: #fff;
    background: #25282d;
    font-size: 0.8rem;
    white-space: nowrap;
    pointer-events: none;
  `,
};

export default RecordRecommendButton;
