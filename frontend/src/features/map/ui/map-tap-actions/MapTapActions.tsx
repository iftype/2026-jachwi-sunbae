import { css } from '@emotion/css';

import type { MapTapAction } from '../../model/MapCanvas';

type Props = {
  actions: MapTapAction[];
  className?: string;
};

/**
 * 휴대폰에서 지도를 찍으면 아래쪽에 띄우는 동작 버튼. 찍은 자리에 말풍선을 띄우면 손가락에 가리고 위쪽은 엄지가 닿지 않아,
 * 찍은 자리에는 핀만 두고 버튼은 아래에 둔다. 지도를 움직이거나 빈 곳을 다시 찍으면 화면이 버튼을 거둔다.
 * 데스크탑은 찍은 자리 말풍선(MapCanvas coordinateMenu)을 쓴다.
 */
const MapTapActions = ({ actions, className }: Props) => (
  <div className={`${styles.actions} ${className ?? ''}`.trim()} role="group" aria-label="이 위치에서">
    {actions.map((action) => (
      <button key={action.id} type="button" className={styles.action} onClick={action.onSelect}>
        {action.label}
      </button>
    ))}
  </div>
);

const styles = {
  /* 휴대폰에서 찍은 위치의 동작. 시트 없이 지도 아래쪽에 버튼만 띄운다. */
  actions: css`
    label: MapTapActions-actions;
    position: absolute;
    right: 1rem;
    bottom: calc(1.25rem + var(--map-sheet-bottom, env(safe-area-inset-bottom, 0px)));
    left: 1rem;
    z-index: 35;
    display: flex;
    gap: 0.5rem;
    justify-content: center;
  `,

  action: css`
    label: MapTapActions-action;
    flex: 1;
    max-width: 12rem;
    min-height: 3.25rem;
    padding: 0 1rem;
    border: 0;
    border-radius: 999px;
    background: var(--color-ink);
    color: #fff;
    font-size: 0.9375rem;
    font-weight: 700;
    white-space: nowrap;
    box-shadow: 0 0.4rem 1.2rem rgb(0 0 0 / 22%);

    &:nth-child(2) {
      background: var(--color-surface);
      color: var(--color-ink);
    }

    &:active {
      transform: scale(0.98);
    }
  `,
};

export default MapTapActions;
