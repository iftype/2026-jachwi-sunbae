import type { MapAddress, MapMarker } from '@/features/map/model/Map';
import MapCanvas from '@/features/map/ui/map-canvas/MapCanvas';
import MapCategoryRail from '@/features/map/ui/map-category-rail/MapCategoryRail';
import StreetMemoSheet from '@/features/street-memo/ui/street-memo-sheet/StreetMemoSheet';
import Icon from '@/shared/ui/icon/Icon';

import type { RecordsState } from '../hooks/useRecords';
import type useRecordsAddMode from '../hooks/useRecordsAddMode';
import type { RecordsMapLayers } from '../hooks/useRecordsMapLayers';
import { recordsMapHint } from '../model/recordPresentation';
import RecordsAddBar from './RecordsAddBar';
import RecordsAddButton from './RecordsAddButton';
import RecordsSelectedCard from './RecordsSelectedCard';

import styles from './RecordsMobileMap.module.css';

const ADD_POINT_MARKER_ID = 'add-point';

type Props = {
  records: RecordsState;
  layers: RecordsMapLayers;
  addMode: ReturnType<typeof useRecordsAddMode>;
  onAddProperty: (address: MapAddress) => void;
};

/**
 * 휴대폰·태블릿 본 방 기록 지도. 위에 뜬 헤더 아래로 시설·거리 메모 카테고리 레일을 둔다.
 * 마커를 누르려다 잘못 찍기 쉬워 평소에 빈 곳을 찍으면 열린 매물·메모를 닫기만 한다.
 * 메모·매물은 가운데 아래 추가 버튼에서 고르면 추가 모드에 들어가, 마커를 모두 거둔 지도에서 위치를 찍어 고른다.
 */
const RecordsMobileMap = ({ records, layers, addMode, onAddProperty }: Props) => {
  const { selected } = records;
  const { isAddMode } = addMode;
  const addMarkers: MapMarker[] =
    addMode.coordinate === null
      ? []
      : [{ ...addMode.coordinate, id: ADD_POINT_MARKER_ID, label: '선택한 위치', tone: 'destination' }];
  const confirmAdd = () => {
    if (addMode.kind === 'property') {
      if (addMode.address !== null) onAddProperty(addMode.address);
      return;
    }
    const point = addMode.coordinate;
    addMode.cancel();
    if (point !== null) layers.memo.startDraft(point);
  };
  const hasBottomLayer = selected !== undefined || layers.memo.mode !== null;
  const { canvasProps } = layers;
  return (
    <section className={styles.map} aria-label="본 방 기록 지도">
      <MapCanvas
        {...canvasProps}
        // 추가 모드에서는 매물·시설·메모 마커를 모두 거두고, 찍은 자리를 추가할 위치로 고른다.
        markers={isAddMode ? addMarkers : canvasProps.markers}
        selectedMarkerId={isAddMode ? null : canvasProps.selectedMarkerId}
        onSelectMarker={isAddMode ? undefined : canvasProps.onSelectMarker}
        onSelectLocation={
          isAddMode ? (latitude, longitude) => addMode.select({ latitude, longitude }) : layers.closeAll
        }
      />
      {!isAddMode && (
        <MapCategoryRail
          showMemo
          className={styles.rail}
          selectedCategories={layers.category === null ? [] : [layers.category]}
          counts={layers.counts}
          onToggle={layers.toggleCategory}
        />
      )}
      <button className={styles.recenter} type="button" aria-label="선택한 동네로 지도 이동" onClick={records.recenter}>
        <Icon name="target" size={22} />
      </button>
      {addMode.kind !== null ? (
        <RecordsAddBar
          kind={addMode.kind}
          coordinate={addMode.coordinate}
          address={addMode.address}
          status={addMode.addressStatus}
          onCancel={addMode.cancel}
          onConfirm={confirmAdd}
        />
      ) : (
        <>
          {!hasBottomLayer && (
            <RecordsAddButton
              hint={recordsMapHint(records.records, layers, false)}
              onChoose={(kind) => {
                layers.closeAll();
                addMode.enter(kind);
              }}
            />
          )}
          {selected && <RecordsSelectedCard record={selected} onClose={() => records.setSelectedId(null)} />}
          <StreetMemoSheet layer={layers.memo} onCreated={layers.showMemos} />
        </>
      )}
    </section>
  );
};

export default RecordsMobileMap;
