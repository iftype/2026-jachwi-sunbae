import type { ReactNode } from 'react';

import { SERVICE_MAP_STYLE_ID } from '@/features/map/lib/mapStyle';
import MapCanvas from '@/features/map/ui/map-canvas/MapCanvas';
import Icon from '@/shared/ui/icon/Icon';

import type { RecordsState } from '../../hooks/useRecords';

import styles from './RecordsMap.module.css';

type RecordsMapProps = {
  records: RecordsState;
  className?: string;
  /** 지도 위에 뜬 요소에 가리지 않게 현재 위치 버튼·안내 문구 위치를 화면별로 옮길 때 쓴다. */
  recenterClassName?: string;
  hintClassName?: string;
  /** 지도 위에 함께 띄울 요소(동네 뱃지, 선택 매물 카드 등). */
  children?: ReactNode;
};

/** 본 방 기록 지도. 동네 찾기 지도와 같은 스타일로 기록한 방만 표시한다. */
const RecordsMap = ({ records, className, recenterClassName, hintClassName, children }: RecordsMapProps) => (
  <section className={`${styles.map} ${className ?? ''}`.trim()} aria-label="본 방 기록 지도">
    <MapCanvas
      customStyleId={SERVICE_MAP_STYLE_ID}
      center={records.center}
      markers={records.markers}
      level={records.level}
      selectedMarkerId={records.selected?.id ?? null}
      onSelectMarker={(marker) => records.setSelectedId(marker.id)}
      onCenterChange={(latitude, longitude) => records.setCenter({ latitude, longitude })}
      onLevelChange={records.setLevel}
    />
    <button
      className={`${styles.recenter} ${recenterClassName ?? ''}`.trim()}
      type="button"
      aria-label="선택한 동네로 지도 이동"
      onClick={records.recenter}
    >
      <Icon name="target" size={22} />
    </button>
    {!records.selected && (
      <span className={`${styles.hint} ${hintClassName ?? ''}`.trim()}>
        {records.records.length ? '내가 기록한 방만 표시돼요' : '아직 기록한 방이 없어요'}
        {records.records.some((record) => record.latitude === null || record.longitude === null)
          ? ' · 위치 없는 기록은 리스트에서 확인해요'
          : ''}
      </span>
    )}
    {children}
  </section>
);

export default RecordsMap;
