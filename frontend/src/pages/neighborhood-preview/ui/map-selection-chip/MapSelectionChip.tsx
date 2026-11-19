import { css } from '@emotion/css';

type Props = {
  onSelect: () => void;
};

/** 데스크탑 동네 찾기 지도 위에 띄우는 칩. 조건 패널의 `지도에서 선택`과 같은 선택 모드를 지도 위에서 바로 켠다. */
const MapSelectionChip = ({ onSelect }: Props) => (
  <button className={styles.chip} type="button" onClick={onSelect}>
    지도에서 출퇴근 장소 선택
  </button>
);

const styles = {
  chip: css`
    label: MapSelectionChip-chip;
    position: absolute;
    top: 3.75rem;
    left: calc(var(--map-panel-width, 0px) + 1rem);
    z-index: 33;
    min-height: 2.25rem;
    padding: 0.4rem 0.9rem;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    background: var(--color-surface);
    box-shadow: var(--shadow-floating);
    color: var(--color-brand-blue-ink);
    font: inherit;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
  `,
};

export default MapSelectionChip;
