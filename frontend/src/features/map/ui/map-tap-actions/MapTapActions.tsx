import type { MapTapAction } from '../../model/MapCanvas';

import styles from './MapTapActions.module.css';

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

export default MapTapActions;
