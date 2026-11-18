import { css } from '@emotion/css';

import Icon from '../icon/Icon';

type Props = { onClick: () => void };

/**
 * 휴대폰 지도와 리스트의 오른쪽 아래 구석에 하나만 두는 `매물 추가` 버튼. 기록 지도와 동네 찾기가 같은 자리, 같은 모양으로 쓴다.
 * 아래 가운데 보기 스위치와 겹치지 않게 원형으로 두고, 시트가 올라오면 화면이 이 버튼을 내린다.
 */
const MapAddPropertyButton = ({ onClick }: Props) => (
  <button type="button" className={styles.button} aria-label="매물 추가" onClick={onClick}>
    <Icon name="plus" size={22} />
    <span aria-hidden="true">매물 추가</span>
  </button>
);

const styles = {
  button: css`
    label: MapAddPropertyButton-root;
    position: fixed;
    right: 0.95rem;
    bottom: calc(env(safe-area-inset-bottom) + 0.75rem);
    z-index: 21;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.05rem;
    width: 3.6rem;
    height: 3.6rem;
    padding: 0;
    border: 0;
    border-radius: 50%;
    color: var(--color-on-primary);
    background: var(--color-primary);
    box-shadow: var(--shadow-floating);
    font: inherit;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1.1;
    white-space: nowrap;
    cursor: pointer;
    pointer-events: auto;

    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 3px;
    }
  `,
};

export default MapAddPropertyButton;
