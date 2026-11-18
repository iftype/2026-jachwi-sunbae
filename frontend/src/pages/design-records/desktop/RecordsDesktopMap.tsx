import { css } from '@emotion/css';
import type { ReactNode } from 'react';

import MapCanvas from '@/features/map/ui/map-canvas/MapCanvas';
import MapZoomControl from '@/features/map/ui/map-zoom-control/MapZoomControl';
import StreetMemoImpressionLog from '@/features/street-memo/ui/street-memo-impression-log/StreetMemoImpressionLog';
import StreetMemoPanel from '@/features/street-memo/ui/street-memo-panel/StreetMemoPanel';
import Icon from '@/shared/ui/icon/Icon';

import type { RecordsState } from '../hooks/useRecords';
import type { RecordsMapLayers } from '../hooks/useRecordsMapLayers';
import { recordsMapHint } from '../model/recordPresentation';
import RecordMapTapIntro from '../ui/record-map-tap-intro/RecordMapTapIntro';
import RecordRecommendButton from '../ui/record-recommend-button/RecordRecommendButton';
import RecordRegisterSuggestion from '../ui/record-register-suggestion/RecordRegisterSuggestion';

type Props = {
  records: RecordsState;
  layers: RecordsMapLayers;
  /** 지도 위에 띄우는 동네 뱃지. */
  districts: ReactNode;
  className?: string;
};

/**
 * 데스크탑 본 방 기록 지도. 기록한 방과 늘 켜 둔 거리 메모, 현재 위치, 확대 축소를 둔다. 시설 분류는 동네 찾기로 옮겼다.
 * 빈 곳을 찍으면 그 자리 말풍선에서 메모를 남기거나 매물을 등록한다. 메모는 지도 위 카드에서 보고,
 * 겹쳐 묶인 매물은 리스트에 이미 모두 보여 따로 늘어놓지 않고 누르면 갈라져 보일 때까지 다가간다.
 */
const RecordsDesktopMap = ({ records, layers, districts, className }: Props) => (
  <section className={`${styles.map} ${className ?? ''}`.trim()} aria-label="본 방 기록 지도">
    <MapCanvas shared {...layers.canvasProps} coordinateMenu={layers.coordinateMenu} />
    <RecordMapTapIntro hasTapped={layers.tapPoint !== null || layers.memo.mode !== null} />
    <StreetMemoImpressionLog memos={layers.memo.visibleMemos} />
    {districts}
    <button
      className={styles.recenter}
      type="button"
      aria-label="현재 위치로 이동"
      onClick={() => records.moveToCurrentLocation(layers.suggestRegisterAt)}
    >
      <Icon name="target" size={22} />
    </button>
    <MapZoomControl className={styles.zoom} level={records.level} onChange={records.setLevel} />
    {!records.selected && layers.memo.mode === null && (
      <span className={styles.hint}>{recordsMapHint(records.records, layers)}</span>
    )}
    <StreetMemoPanel layer={layers.memo} className={styles.memoCard} />
    {layers.recommendMode && (
      <RecordRecommendButton isActive={layers.recommendMode.isActive} onToggle={layers.recommendMode.toggle} />
    )}
    <RecordRegisterSuggestion
      isOpen={layers.isSuggestingRegister}
      onAccept={layers.acceptRegisterSuggestion}
      onClose={layers.closeRegisterSuggestion}
    />
  </section>
);

const styles = {
  /* 데스크탑 본 방 기록 지도: 오른쪽 칸 전체. 동네 뱃지는 위에, 확대 축소와 현재 위치는 오른쪽에, 메모 카드는 왼쪽 위에 띄운다. */
  map: css`
    label: RecordsDesktopMap-map;
    position: relative;
    min-width: 0;
    min-height: 0;
  `,

  recenter: css`
    label: RecordsDesktopMap-recenter;
    position: absolute;
    top: 21.25rem;
    right: 1.15rem;
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

  /* 지도 오른쪽 위, 동네 뱃지 줄과 같은 높이에 둔다. */
  zoom: css`
    label: RecordsDesktopMap-zoom;
    top: 4.75rem;
    right: 1.15rem;
  `,

  hint: css`
    label: RecordsDesktopMap-hint;
    position: absolute;
    bottom: 2.75rem;
    left: calc(var(--map-panel-width, 0px) + 2rem);
    padding: 0.5rem 0.7rem;
    border-radius: 0.5rem;
    background: #ffffffed;
    color: #92969d;
    font-size: 0.8rem;
  `,

  /* 메모 카드와 겹친 매물 카드는 오른쪽 버튼을 가리지 않게 왼쪽 위, 동네 뱃지 아래에 띄운다. 둘은 함께 열리지 않는다. */
  memoCard: css`
    label: RecordsDesktopMap-memoCard;
    position: absolute;
    top: calc(var(--unified-panel-top, 0px) + 4.5rem);
    left: calc(var(--map-panel-width, 0px) + 2rem);
    z-index: 30;
    width: min(22rem, calc(100% - 6rem));
    max-height: calc(100% - 6rem);
    overflow-y: auto;
    border: 1px solid var(--color-border);
    border-radius: 1rem;
    background: var(--color-surface);
    box-shadow: 0 0.5rem 1.5rem rgb(0 0 0 / 14%);
  `,
};

export default RecordsDesktopMap;
