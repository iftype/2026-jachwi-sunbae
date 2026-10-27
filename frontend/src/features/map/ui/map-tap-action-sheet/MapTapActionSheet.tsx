import BottomSheet from '@/shared/ui/bottom-sheet/BottomSheet';

import type { MapTapAction } from '../../model/MapCanvas';

import styles from './MapTapActionSheet.module.css';

type Props = {
  title?: string;
  actions: MapTapAction[];
  onClose: () => void;
};

/**
 * 휴대폰에서 지도를 찍으면 아래에 띄우는 동작 목록. 찍은 자리에 말풍선을 띄우면 손가락에 가리고 위쪽은 엄지가 닿지 않아,
 * 찍은 자리에는 핀만 두고 고르는 것은 아래에서 한다. 데스크탑은 찍은 자리 말풍선(MapCanvas coordinateMenu)을 쓴다.
 */
const MapTapActionSheet = ({ title = '이 위치에서', actions, onClose }: Props) => (
  <BottomSheet title={title} resizable={false} initialHeightPercent={actions.length > 1 ? 30 : 24} onClose={onClose}>
    <div className={styles.actions}>
      {actions.map((action) => (
        <button key={action.id} type="button" className={styles.action} onClick={action.onSelect}>
          {action.label}
        </button>
      ))}
    </div>
  </BottomSheet>
);

export default MapTapActionSheet;
