import type { ReactNode } from 'react';

import MapCanvas from '@/features/map/ui/map-canvas/MapCanvas';
import MapCategoryRail from '@/features/map/ui/map-category-rail/MapCategoryRail';
import StreetMemoPanel from '@/features/street-memo/ui/street-memo-panel/StreetMemoPanel';
import Icon from '@/shared/ui/icon/Icon';

import type { RecordsState } from '../hooks/useRecords';
import type { RecordsMapLayers } from '../hooks/useRecordsMapLayers';
import { recordsMapHint } from '../model/recordPresentation';

import styles from './RecordsDesktopMap.module.css';

type Props = {
  records: RecordsState;
  layers: RecordsMapLayers;
  /** 지도 위에 띄우는 동네 뱃지. */
  districts: ReactNode;
  className?: string;
};

/**
 * 데스크탑 본 방 기록 지도. 기록한 방에 더해 시설·거리 메모 카테고리를 켜 볼 수 있고,
 * 빈 곳을 찍으면 그 자리 말풍선에서 메모를 남기거나 매물을 등록한다. 메모는 지도 위 카드에서 쓰고 본다.
 */
const RecordsDesktopMap = ({ records, layers, districts, className }: Props) => (
  <section className={`${styles.map} ${className ?? ''}`.trim()} aria-label="본 방 기록 지도">
    <MapCanvas {...layers.canvasProps} coordinateMenu={layers.coordinateMenu} />
    <div className={styles.districts}>{districts}</div>
    <MapCategoryRail
      showMemo
      className={styles.rail}
      selectedCategories={layers.category === null ? [] : [layers.category]}
      counts={layers.counts}
      onToggle={layers.toggleCategory}
    />
    <button className={styles.recenter} type="button" aria-label="선택한 동네로 지도 이동" onClick={records.recenter}>
      <Icon name="target" size={22} />
    </button>
    {!records.selected && layers.memo.mode === null && (
      <span className={styles.hint}>{recordsMapHint(records.records, layers)}</span>
    )}
    <StreetMemoPanel layer={layers.memo} onCreated={layers.showMemos} className={styles.memoCard} />
  </section>
);

export default RecordsDesktopMap;
