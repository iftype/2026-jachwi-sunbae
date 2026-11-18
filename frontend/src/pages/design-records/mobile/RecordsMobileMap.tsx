import { css } from '@emotion/css';

import MapCanvas from '@/features/map/ui/map-canvas/MapCanvas';
import MapZoomControl from '@/features/map/ui/map-zoom-control/MapZoomControl';
import StreetMemoImpressionLog from '@/features/street-memo/ui/street-memo-impression-log/StreetMemoImpressionLog';
import StreetMemoSheet from '@/features/street-memo/ui/street-memo-sheet/StreetMemoSheet';
import Icon from '@/shared/ui/icon/Icon';

import type { RecordsState } from '../hooks/useRecords';
import type { RecordsMapLayers } from '../hooks/useRecordsMapLayers';
import { recordNeighbors } from '../model/recordNavigation';
import RecordBookmarkToggle from '../ui/record-bookmark-toggle/RecordBookmarkToggle';
import RecordRegisterSuggestion from '../ui/record-register-suggestion/RecordRegisterSuggestion';
import RecordStepper from '../ui/record-stepper/RecordStepper';
import RecordsSelectedSheet from './RecordsSelectedSheet';

type Props = {
  records: RecordsState;
  layers: RecordsMapLayers;
};

/**
 * 휴대폰, 태블릿 본 방 기록 지도. 위에 뜬 헤더 아래로 확대 축소와 현재 위치 버튼을 두고 거리 메모는 늘 띄운다. 시설 분류는 동네 찾기로 옮겼다.
 * 데스크탑처럼 빈 곳을 찍으면 그 자리 말풍선에서 메모를 남기거나 매물을 등록한다. 열린 것이 있으면 먼저 닫기만 한다.
 * 고른 매물은 아래 바텀시트에서 보고, 겹쳐 묶인 매물은 시트에 함께 늘어놓는다.
 * 매물 하나를 볼 때는 시트 머리의 이전, 다음으로 목록 순서대로 넘기고, 지도와 마커 선택도 그 매물로 따라간다.
 */
const RecordsMobileMap = ({ records, layers }: Props) => {
  const { selected } = records;
  const sheetRecords = layers.groupRecords.length > 0 ? layers.groupRecords : selected ? [selected] : [];
  // 겹친 매물 묶음을 볼 때는 넘길 기준이 하나가 아니라 화살표를 두지 않는다.
  const neighbors = layers.groupRecords.length === 0 && selected ? recordNeighbors(records.records, selected.id) : null;
  return (
    <section className={styles.map} aria-label="본 방 기록 지도">
      <MapCanvas shared {...layers.canvasProps} coordinateMenu={layers.coordinateMenu} />
      <StreetMemoImpressionLog memos={layers.memo.visibleMemos} />
      <RecordBookmarkToggle bookmarks={layers.bookmarks} />
      <button
        className={styles.recenter}
        type="button"
        aria-label="현재 위치로 이동"
        onClick={() => records.moveToCurrentLocation(layers.suggestRegisterAt)}
      >
        <Icon name="target" size={22} />
      </button>
      <MapZoomControl className={styles.zoom} level={records.level} onChange={records.setLevel} />
      <RecordsSelectedSheet
        records={sheetRecords}
        onClose={layers.closeAll}
        stepper={neighbors && <RecordStepper neighbors={neighbors} onStep={records.showRecord} />}
        onNotice={records.setNotice}
      />
      <StreetMemoSheet layer={layers.memo} />
      <RecordRegisterSuggestion
        isOpen={layers.isSuggestingRegister}
        onAccept={layers.acceptRegisterSuggestion}
        onClose={layers.closeRegisterSuggestion}
      />
    </section>
  );
};

const styles = {
  /* 휴대폰, 태블릿 본 방 기록 지도. 위에 뜬 헤더와 동네 뱃지 아래로 확대 축소와 현재 위치 버튼을 두고, 아래쪽에 지도 안내를 띄운다. */
  map: css`
    label: RecordsMobileMap-map;
    position: relative;
    flex: 1;
    min-height: 0;
  `,

  /* 세로 확대 축소 버튼 바로 아래에 둔다. */
  recenter: css`
    label: RecordsMobileMap-recenter;
    position: absolute;
    /* 확대 축소 바로 아래(zoom 8rem + 높이 약 5.3rem + 간격 0.5rem)에 붙인다. */
    top: calc(max(0.85rem, env(safe-area-inset-top)) + 13.8rem);
    right: 0.95rem;
    z-index: 12;
    display: grid;
    place-items: center;
    width: 2.65rem;
    height: 2.65rem;
    border: 0;
    border-radius: 50%;
    color: #41444b;
    background: #fff;
    box-shadow: 0 2px 10px #00000016;
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid #25282d;
      outline-offset: 3px;
    }
  `,

  /* 헤더와 동네 뱃지 아래 오른쪽 위에 두고, 현재 위치 버튼은 그 아래에 둔다. */
  zoom: css`
    label: RecordsMobileMap-zoom;
    top: calc(max(0.85rem, env(safe-area-inset-top)) + 8rem);
    right: 0.95rem;
  `,
};

export default RecordsMobileMap;
