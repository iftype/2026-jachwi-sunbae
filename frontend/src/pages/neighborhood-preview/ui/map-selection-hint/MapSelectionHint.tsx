import { css } from '@emotion/css';

type Props = {
  onCancel: () => void;
  /** 띠가 지도 위에서 놓일 위치(CSS `top`). 화면 위쪽 헤더를 비킬 때 쓴다. */
  top?: string;
};

/** `지도에서 선택`으로 선택 모드에 들어간 동안 지도 위에 띄우는 안내 띠. 취소하면 선택 모드를 벗어난다. */
const MapSelectionHint = ({ onCancel, top }: Props) => (
  <div className={styles.hint} style={top ? { top } : undefined} role="status">
    <span>지도에서 출퇴근 장소를 눌러 주세요</span>
    <button type="button" onClick={onCancel}>
      취소
    </button>
  </div>
);

const styles = {
  hint: css`
    label: MapSelectionHint-hint;
    position: absolute;
    top: 1rem;
    /* 데스크탑은 떠 있는 패널을 뺀 보이는 지도 칸의 가운데에 둔다. */
    left: calc(50% + var(--map-panel-width, 0px) / 2);
    z-index: 33;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.6rem 0.5rem 0.9rem;
    border-radius: 999px;
    background: var(--color-brand-blue-ink);
    box-shadow: var(--shadow-floating);
    color: #fff;
    font-size: 0.85rem;
    font-weight: 700;
    white-space: nowrap;
    transform: translateX(-50%);

    & button {
      padding: 0.2rem 0.7rem;
      border: 0;
      border-radius: 999px;
      background: #fff;
      color: var(--color-brand-blue-ink);
      font: inherit;
      font-size: 0.78rem;
      font-weight: 800;
      cursor: pointer;
    }
  `,
};

export default MapSelectionHint;
