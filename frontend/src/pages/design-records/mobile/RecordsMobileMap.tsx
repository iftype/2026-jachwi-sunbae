import { css, cx } from '@emotion/css';

import MapCanvas from '@/features/map/ui/map-canvas/MapCanvas';
import StreetMemoImpressionLog from '@/features/street-memo/ui/street-memo-impression-log/StreetMemoImpressionLog';
import StreetMemoSheet from '@/features/street-memo/ui/street-memo-sheet/StreetMemoSheet';
import { hideWhenSheetExpanded } from '@/shared/ui/bottom-sheet/hideWhenSheetExpanded';
import Icon from '@/shared/ui/icon/Icon';

import type { RecordsState } from '../hooks/useRecords';
import type { RecordsMapLayers } from '../hooks/useRecordsMapLayers';
import { recordNeighbors } from '../model/recordNavigation';
import RecordNeighborhoodBanner from '../ui/record-neighborhood-banner/RecordNeighborhoodBanner';
import RecordRegisterSuggestion from '../ui/record-register-suggestion/RecordRegisterSuggestion';
import RecordStepper from '../ui/record-stepper/RecordStepper';
import RecordsSelectedSheet from './RecordsSelectedSheet';

type Props = {
  records: RecordsState;
  layers: RecordsMapLayers;
};

/**
 * 휴대폰, 태블릿 본 방 기록 지도. 현재 위치 버튼은 오른쪽 아래에 두고(시트가 열리면 시트 위로 따라 오른다) 거리 메모는 늘 띄운다. 확대 축소 버튼은 없다. 시설 분류는 동네 찾기로 옮겼다.
 * 데스크탑처럼 빈 곳을 찍으면 그 자리 말풍선에서 메모를 남기거나 매물을 등록한다. 열린 것이 있으면 먼저 닫기만 한다.
 * 고른 매물은 아래 바텀시트에서 보고, 겹쳐 묶인 매물은 시트에 함께 늘어놓는다.
 * 매물 하나를 볼 때는 시트 머리의 이전, 다음으로 목록 순서대로 넘기고, 지도와 마커 선택도 그 매물로 따라간다.
 */
const RecordsMobileMap = ({ records, layers }: Props) => {
  const { selected } = records;
  const sheetRecords = layers.groupRecords.length > 0 ? layers.groupRecords : selected ? [selected] : [];
  // 겹친 매물 묶음을 볼 때는 넘길 기준이 하나가 아니라 화살표를 두지 않는다.
  const neighbors = layers.groupRecords.length === 0 && selected ? recordNeighbors(records.records, selected.id) : null;
  // 확대 축소 버튼은 두지 않는다(두 손가락으로 확대한다). 시트가 열려 있으면 시트 바로 위에 띄워 함께 오르내리고,
  // 시트를 크게 열면 시트 뒤로 숨긴다. 시트가 없으면 하단 탭 위 오른쪽 아래에 둔다.
  const hasSheet = sheetRecords.length > 0 || layers.memo.mode !== null;
  const locateButton = (className: string) => (
    <button
      className={className}
      type="button"
      aria-label="현재 위치로 이동"
      onClick={() => records.moveToCurrentLocation(layers.suggestRegisterAt)}
    >
      <Icon name="target" size={22} />
    </button>
  );
  const sheetLocate = locateButton(styles.recenterDocked);
  return (
    <section className={styles.map} aria-label="본 방 기록 지도">
      <MapCanvas shared {...layers.canvasProps} coordinateMenu={layers.coordinateMenu} />
      <StreetMemoImpressionLog memos={layers.memo.visibleMemos} />
      {!hasSheet && locateButton(styles.recenterCorner)}
      {sheetRecords.length === 0 && layers.memo.mode === null && <RecordNeighborhoodBanner className={styles.banner} />}
      <RecordsSelectedSheet
        records={sheetRecords}
        onClose={layers.closeAll}
        stepper={neighbors && <RecordStepper neighbors={neighbors} onStep={records.showRecord} />}
        onNotice={records.setNotice}
        floating={layers.memo.mode === null ? sheetLocate : undefined}
      />
      <StreetMemoSheet layer={layers.memo} floating={sheetLocate} />
      <RecordRegisterSuggestion
        isOpen={layers.isSuggestingRegister}
        onAccept={layers.acceptRegisterSuggestion}
        onClose={layers.closeRegisterSuggestion}
      />
    </section>
  );
};

const recenter = css`
  label: RecordsMobileMap-recenter;
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
`;

const styles = {
  /* 휴대폰, 태블릿 본 방 기록 지도. */
  map: css`
    label: RecordsMobileMap-map;
    position: relative;
    flex: 1;
    min-height: 0;
  `,

  /* 아래 가운데 보기 방식 스위치(fixed, 약 3rem) 위에 둔다. */
  banner: css`
    label: RecordsMobileMap-banner;
    bottom: calc(var(--map-sheet-bottom, env(safe-area-inset-bottom)) + 4.75rem);
  `,

  /* 시트가 없을 때: 하단 탭 위(`--map-sheet-bottom`) 오른쪽 아래. */
  recenterCorner: cx(
    recenter,
    css`
      label: RecordsMobileMap-recenterCorner;
      position: absolute;
      right: 1rem;
      bottom: calc(var(--map-sheet-bottom, env(safe-area-inset-bottom, 0px)) + 0.75rem);
      z-index: 12;
    `,
  ),

  /* 시트 위 `floating` 칸 안에서는 위치를 시트가 정한다. 시트를 크게 열면 숨긴다. */
  recenterDocked: cx(recenter, hideWhenSheetExpanded),
};

export default RecordsMobileMap;
