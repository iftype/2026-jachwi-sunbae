import { css, cx } from '@emotion/css';
import { useRef, useState } from 'react';
import { Outlet, useMatch } from 'react-router-dom';

import { useRecordsMapController } from '@/pages/design-records/RecordsMapProvider';
import MapCanvas from '@/features/map/ui/map-canvas/MapCanvas';
import ExplorationRecordAction from '@/features/onboarding/ui/exploration-record-action/ExplorationRecordAction';
import { LogClick } from '@/shared/lib/analytics/logging';
import { NEIGHBORHOOD_ADDRESS_SEARCH_PATH, ROUTE_PATTERNS } from '@/shared/lib/navigation/appPaths';
import BottomSheet from '@/shared/ui/bottom-sheet/BottomSheet';
import { hideWhenSheetExpanded } from '@/shared/ui/bottom-sheet/hideWhenSheetExpanded';
import { setSheetCollapsed, useSheetCollapsed } from '@/shared/ui/bottom-sheet/sheetCollapse';
import { Button } from '@/shared/ui/button/Button';
import Icon from '@/shared/ui/icon/Icon';
import { useMapPanel } from '@/shared/ui/map-list-header/MapPanelContext';
import MobileMapHeader, { MapHomeLink } from '@/shared/ui/mobile-map-header/MobileMapHeader';

import useMyPropertyPager from '../hooks/useMyPropertyPager';
import useNeighborhoodMapView from '../hooks/useNeighborhoodMapView';
import type { NeighborhoodPreviewContext } from '../hooks/useNeighborhoodPreview';
import useResultMapViewport from '../hooks/useResultMapViewport';
import { rentLabel, RESELECT_COMMUTE_LABEL, transferLabel } from '../model/criteriaLabels';
import { MOBILE_AREA_SHEET_PERCENT, mobileMapViewport } from '../model/resultMapView';
import type { NeighborhoodFilterField } from '../NeighborhoodFilters';
import { NeighborhoodFilterPicker } from '../NeighborhoodFilters';
import AnalysisOverlay from '../ui/analysis-overlay/AnalysisOverlay';
import CommuteDestinationField from '../ui/commute-destination-field/CommuteDestinationField';
import CommuteLegend from '../ui/commute-legend/CommuteLegend';
import CriteriaSummary from '../ui/criteria-summary/CriteriaSummary';
import LocationControls from '../ui/location-controls/LocationControls';
import MapInfo, { type MapInfoSubject, mapInfoTitle } from '../ui/map-info/MapInfo';
import NeighborhoodMapSearch from '../ui/map-search/NeighborhoodMapSearch';
import MapSelectionHint from '../ui/map-selection-hint/MapSelectionHint';
import RentSlider from '../ui/rent-slider/RentSlider';

import * as shared from '../NeighborhoodPreviewPage.styles';

type Props = {
  preview: NeighborhoodPreviewContext;
};

/**
 * 휴대폰 동네 찾기. 지도를 화면 전체에 두고 조건은 지도 아래 시트의 조건 칸으로, 결과는 지도 아래 가로 레일로 고른다.
 * 대중교통 상세는 지도 없이 화면 전체로 연다.
 */
const NeighborhoodPreviewMobilePage = ({ preview }: Props) => {
  const controller = useRecordsMapController();
  const usesSharedSearch = controller !== null && !preview.isPublicExplore;
  const returnButton = !preview.isPublicExplore && <MapHomeLink />;
  const panel = useMapPanel();
  // 위치를 고르는 동안 조건 칸 아래에 바로 펼친 피커. 같은 칸을 다시 누르면 접는다.
  // 결과를 지도로 볼지 동네 목록으로 볼지. 기록 화면의 리스트와 지도 전환과 같은 짝이다.
  const [pickerField, setPickerField] = useState<NeighborhoodFilterField | null>(null);
  const isRoutePage = useMatch(`${preview.mapPath}/${ROUTE_PATTERNS.area}/*`);
  const isDetailPage = useMatch(`${preview.mapPath}/${ROUTE_PATTERNS.areaDetails}`);
  const submitSearch = preview.startAnalysis;
  // 지도 빈 곳을 찍으면 시트를 닫지 않고 제목만 보이게 내린다.
  const [peekSignal, setPeekSignal] = useState(0);
  const [isRentOpen, setIsRentOpen] = useState(false);
  const reselectCommute = () => {
    closeLayers();
    preview.selectRegion(null);
    setPickerField(null);
    setIsRentOpen(false);
    preview.editLocation();
  };
  // 동네 시트를 닫아도 동네 선택(지도 강조, 주소)은 남긴다. 닫은 동네의 행정동 코드를 두어 그 동네의 시트만 숨긴다.
  const [dismissedAreaCode, setDismissedAreaCode] = useState<string | null>(null);
  const selectedAreaCode = preview.selected?.adminDongCode;
  // 고른 동네가 바뀌면(풀었다가 같은 동네를 다시 골라도) 닫아 둔 기록을 지워, 새로 고른 동네 시트가 열리게 한다.
  const [lastAreaCode, setLastAreaCode] = useState(selectedAreaCode);
  if (lastAreaCode !== selectedAreaCode) {
    setLastAreaCode(selectedAreaCode);
    setDismissedAreaCode(null);
  }
  const isAreaSheetDismissed = dismissedAreaCode !== null && dismissedAreaCode === selectedAreaCode;
  // 빈 곳을 찍었을 때 할 일은 그때 열린 시트에 따라 다르다. 지도 설정보다 뒤에 정해지므로 렌더마다 새로 넣어 둔다.
  const emptyTapRef = useRef<() => void>(() => undefined);
  // 정보는 한 단계 시트 하나에만 둔다: 누른 마커 하나, 고른 동네, `My` 매물 목록 가운데 하나.
  const mapView = useNeighborhoodMapView(preview, {
    showAreaAction: false,
    onEmptyTap: () => emptyTapRef.current(),
    // 시트를 닫아 둔 동네 안을 다시 찍으면 그 동네 시트를 다시 연다.
    onSelectedRegionTap: isAreaSheetDismissed ? () => setDismissedAreaCode(null) : undefined,
  });
  const { isResultMap, mapProps, places, closeLayers } = mapView;
  const recordArea = preview.selected ?? preview.topAreas[0];
  const summary = (
    <CriteriaSummary preview={preview} isRentOpen={isRentOpen} onToggleRent={() => setIsRentOpen((open) => !open)} />
  );
  const selectedArea = isRoutePage && !isAreaSheetDismissed ? preview.selected : undefined;
  // 위치를 고르는 지도(선택 전, 선택 중)에서는 눌러 연 내 매물 하나만 시트에 둔다.
  const infoSubject: MapInfoSubject | null = places.selectedPlace
    ? { kind: 'place', place: places.selectedPlace }
    : selectedArea && isResultMap
      ? { kind: 'area', area: selectedArea }
      : null;
  // 내 매물 시트는 위에 매물 요약, 아래에 노선을 두어 한 단계 더 높게 열고 끌어 올릴 수 있다.
  const isPropertySheet = infoSubject?.kind === 'place' && infoSubject.place.kind === 'property';
  // 선택한 매물 시트를 접어 둔 선호(내 기록 모바일과 같은 세션 상태). 접어도 고른 매물과 지도 마커는 그대로고, 마커를 누르면 펼친다.
  const isSheetCollapsed = useSheetCollapsed();
  const bookmark = infoSubject?.kind === 'area' ? mapView.bookmark(infoSubject.area.adminDongCode) : undefined;
  // 고른 동네가 있으면(시트를 닫아 두었어도) 빈 곳을 찍어 선택을 푼다. 마커나 `My` 시트만 열려 있으면 제목만 보이게 내린다.
  emptyTapRef.current = () => {
    if (preview.selected && (infoSubject === null || infoSubject.kind === 'area')) {
      setDismissedAreaCode(null);
      preview.selectRegion(null);
    } else setPeekSignal((value) => value + 1);
  };
  // `My` 목록에서 고른 매물이면 시트에 이전과 다음 이동, 목록으로 돌아가는 뒤로가기를 둔다.
  const myPager = useMyPropertyPager(infoSubject, mapView);
  // 시트가 없으면 지도 아래 가운데에 두고, 시트가 있으면 시트 바로 위에 띄워(BottomSheet `floating`) 시트 높이와 하단 탭을 그대로 따라가게 한다.
  const reselectButton = (className: string) => (
    <Button className={className} onClick={reselectCommute} data-public={preview.isPublicExplore || undefined}>
      <Icon name="replace" size={18} />
      {RESELECT_COMMUTE_LABEL}
    </Button>
  );
  // 지도는 화면 전체를 쓰고, 위 결과 머리와 아래 시트가 가리는 만큼 비우고 시점을 맞춘다.
  const mapSectionRef = useResultMapViewport<HTMLElement>(preview, (section) => {
    const rect = section.getBoundingClientRect();
    const header = section.querySelector('header');
    return mobileMapViewport(rect, header ? header.getBoundingClientRect().bottom - rect.top : 0);
  });
  // 휴대폰 지도에는 확대 축소 버튼을 두지 않는다(두 손가락으로 확대한다). 현재 위치 버튼만 오른쪽 아래에 두고,
  // 시트가 있으면 시트 바로 위에 띄워(BottomSheet `floating`) 시트가 오르내릴 때 함께 움직이게 한다. 시트를 크게 열면 시트 뒤로 숨긴다.
  const locateControls = (className: string, docked = false) => (
    <LocationControls preview={preview} isResult docked={docked} className={className} />
  );
  // 정보 시트. 결과 지도와 위치를 고르는 지도가 같은 시트를 쓴다.
  const infoSheet = infoSubject && (
    <BottomSheet
      key={infoSubject.kind === 'area' ? `area:${infoSubject.area.adminDongCode}` : infoSubject.kind}
      title={mapInfoTitle(infoSubject)}
      initialHeightPercent={infoSubject.kind === 'area' ? MOBILE_AREA_SHEET_PERCENT : isPropertySheet ? 55 : 40}
      resizable={infoSubject.kind === 'area' || isPropertySheet}
      fullPage={false}
      // 동네 시트는 처음 높이(내용 높이)가 끝이다. 위로 끌어도 커지지 않고, 내리면 닫힌다.
      maxMode={infoSubject.kind === 'area' ? 'default' : undefined}
      className={infoSubject.kind === 'area' ? styles.areaSheet : undefined}
      closeLabel="정보 닫기"
      collapsible={isPropertySheet}
      initialMode={isPropertySheet && isSheetCollapsed ? 'peek' : 'default'}
      onModeChange={isPropertySheet ? (mode) => setSheetCollapsed(mode === 'peek') : undefined}
      onBack={myPager?.backToList}
      headerEnd={
        bookmark ? (
          <button
            type="button"
            className={styles.bookmark}
            aria-label={bookmark.isOn ? '찜한 동네에서 삭제' : '찜한 동네에 추가'}
            aria-pressed={bookmark.isOn}
            onClick={bookmark.onToggle}
          >
            {bookmark.isOn ? '★' : '☆'}
          </button>
        ) : (
          myPager?.controls
        )
      }
      peekSignal={peekSignal}
      floating={
        isResultMap ? (
          <div className={styles.floatingRow}>
            {reselectButton(styles.reselectFloating)}
            {locateControls(styles.locateDocked, true)}
          </div>
        ) : undefined
      }
      onClose={() => {
        if (infoSubject.kind === 'place') closeLayers();
        else if (infoSubject.kind === 'area') setDismissedAreaCode(infoSubject.area.adminDongCode);
        else mapView.clearRail();
      }}
    >
      <MapInfo
        subject={infoSubject}
        preview={preview}
        my={mapView.my}
        onSelectProperty={mapView.selectMyProperty}
        property={mapView.property}
        phoneAction="call"
      />
    </BottomSheet>
  );
  // 통근, 환승, 월세 조건 칸. 위치를 고르기 전후 모두 아래 시트에 둔다.
  // 칸마다 위에 항목, 아래에 값을 적고, 읽을 때는 `통근 40분 이내`처럼 한 문장으로 읽게 한다.
  const filterCells: { field: NeighborhoodFilterField; title: string; value: string; label: string }[] = [
    {
      field: 'minutes',
      title: '통근',
      value: `${preview.maxMinutes}분 이내`,
      label: `통근 ${preview.maxMinutes}분 이내`,
    },
    {
      field: 'transfers',
      title: '환승',
      value: preview.maxTransfers === 0 ? '없음' : `${preview.maxTransfers}회 이하`,
      label: transferLabel(preview.maxTransfers),
    },
    {
      field: 'rent',
      title: '월세',
      value: preview.maxRent === 0 ? '전체' : `${preview.maxRent}만원 이하`,
      label: rentLabel(preview.maxRent),
    },
  ];
  const filterChips = (
    <div className={shared.filterChips} aria-label="탐색 조건">
      {filterCells.map((cell) => (
        <LogClick key={cell.field} event="neighborhood_condition_clicked" params={{ field: cell.field }}>
          <button
            type="button"
            aria-label={cell.label}
            aria-expanded={pickerField === cell.field}
            onClick={() => setPickerField((open) => (open === cell.field ? null : cell.field))}
          >
            <span className={shared.filterCellTitle}>
              {cell.title}
              <Icon name="chevron-down" size={14} />
            </span>
            <span className={shared.filterCellValue}>{cell.value}</span>
          </button>
        </LogClick>
      ))}
    </div>
  );

  if (isDetailPage && !preview.isAnalyzing && !preview.error)
    return (
      <div className={shared.page}>
        <Outlet context={preview} />
      </div>
    );
  if (panel) return <main className={shared.page}>{panel.content}</main>;
  return (
    <main className={shared.page} data-public-explore={preview.isPublicExplore || undefined}>
      <section
        ref={mapSectionRef}
        className={shared.mapPage}
        aria-label={isResultMap ? '행정동 프리셋 지도' : '지도에서 목적지 선택'}
      >
        <MapCanvas
          shared
          animateView
          hideLoading={preview.isAnalyzing || Boolean(preview.error)}
          interactive
          onReady={preview.prefetchBoundaries}
          {...mapProps}
        />
        <AnalysisOverlay preview={preview} />
        {preview.isSelectingOnMap && (
          <>
            <header
              className={usesSharedSearch ? `${shared.searchHeader} ${styles.resultHeader}` : shared.searchHeader}
            >
              {usesSharedSearch ? (
                <MobileMapHeader
                  leading={returnButton}
                  searchTo={NEIGHBORHOOD_ADDRESS_SEARCH_PATH}
                  searchLabel="주소 검색"
                />
              ) : (
                <>
                  {!preview.isPublicExplore && (
                    <MobileMapHeader leading={returnButton} searchTo={NEIGHBORHOOD_ADDRESS_SEARCH_PATH} />
                  )}
                  <NeighborhoodMapSearch preview={preview} hideHome={!preview.isPublicExplore} />
                </>
              )}
            </header>
            {preview.isMapSelectionEnabled && <MapSelectionHint top="5.5rem" onCancel={preview.cancelMapSelection} />}
            {infoSheet}
            {/* 조건 칸과 찾기 버튼은 위치를 고르기 전부터 아래 시트에 두어, 위치를 골라도 자리가 바뀌지 않게 한다.
                위치를 고르기 전에는 찾기 버튼을 막아 두고 장소를 고르라고 적는다. 지도 위 버튼은 말풍선 핀과 겹쳐 두지 않는다. */}
            {
              <section
                className={`${shared.searchCard} ${styles.conditionCard}`}
                aria-label={preview.hasChosenMapPoint ? '고른 출퇴근 장소' : '출퇴근 조건'}
              >
                {/* 조건 카드 위 오른쪽에 붙여, 조건 칸이 펼쳐져 카드가 높아져도 함께 올라간다. */}
                <LocationControls preview={preview} isResult={false} className={styles.locateAboveCard} />
                <p className={shared.searchCardTitle}>이 조건으로 추천받아요</p>
                {/* 출퇴근 장소는 위쪽 지도 검색과 따로 이 칸에서 정한다. 아직 없으면 이 칸이 처음부터 열려 있다. */}
                {usesSharedSearch && <CommuteDestinationField preview={preview} />}
                {/* 통합 지도는 출퇴근 장소 검색 화면의 `지도에서 직접 고르기`로 지도 선택을 켠다. 그 화면이 없는 공개 탐색은 여기서 켠다. */}
                {!usesSharedSearch && (
                  <Button
                    variant="secondary"
                    aria-pressed={preview.isMapSelectionEnabled}
                    onClick={preview.isMapSelectionEnabled ? preview.cancelMapSelection : preview.openMapSelection}
                  >
                    {preview.isMapSelectionEnabled ? '목적지 선택 취소' : '지도에서 목적지 선택'}
                  </Button>
                )}
                {preview.hasSubmittedSearch && (
                  <Button variant="secondary" onClick={preview.cancelEditing}>
                    이전 결과 보기
                  </Button>
                )}
                {filterChips}
                {pickerField !== null && (
                  <NeighborhoodFilterPicker key={pickerField} preview={preview} field={pickerField} />
                )}
                {preview.hasChosenMapPoint ? (
                  <Button fullWidth disabled={!preview.isValidCommuteTime} onClick={submitSearch}>
                    <span className={shared.searchCardLabel}>
                      <span>{preview.mapCandidate.name}</span>에서 찾기
                    </span>
                  </Button>
                ) : (
                  <Button fullWidth disabled>
                    지도에서 출퇴근 장소를 골라 주세요
                  </Button>
                )}
              </section>
            }
          </>
        )}
        {isResultMap && (
          <>
            <header className={`${shared.resultHeader} ${styles.resultHeader}`}>
              {!preview.isPublicExplore ? (
                <MobileMapHeader
                  leading={returnButton}
                  searchTo={NEIGHBORHOOD_ADDRESS_SEARCH_PATH}
                  searchLabel="주소 검색"
                  center={summary}
                  centered
                />
              ) : (
                summary
              )}
              {isRentOpen && <RentSlider preview={preview} bare className={styles.headerSlider} />}
              <div className={styles.filterRow}>
                <div className={styles.legendSlot}>
                  <CommuteLegend maxMinutes={preview.maxMinutes} className={styles.legend} showsNoRent={false} />
                </div>
              </div>
            </header>
            {!infoSubject && locateControls(styles.locateCorner)}

            {!infoSubject && reselectButton(styles.reselect)}
            {preview.isPublicExplore && recordArea && (
              <div className={shared.recordAction}>
                <ExplorationRecordAction
                  location={{
                    ...recordArea.center,
                    address: recordArea.fullName,
                    roadAddress: null,
                    jibunAddress: recordArea.fullName,
                  }}
                />
              </div>
            )}
            {mapView.needsZoomForFacilities && <p className={styles.zoomHint}>확대하면 주변 시설이 보여요</p>}
            {/* 정보는 시트 하나에만 둔다. 마커와 `My`는 한 단계 높이로 두고, 닫으면 그 정보를 닫는다.
                동네는 지도와 고른 동이 같이 보이게 내용 높이로만 열고 더 끌어 올리지 않는다. 닫아도 동네 선택은 그대로 둔다. */}
            {infoSheet}
            {isRoutePage && <Outlet context={preview} />}
          </>
        )}
      </section>
    </main>
  );
};

/* 월세 슬라이더가 위에서 부드럽게 내려온다. */
const styles = {
  /* 동네 시트는 내용이 짧아 아래 여백을 줄인다. 하단 탭 위로 올라오므로 안전 영역은 시트 위치가 이미 비운다. */
  areaSheet: css`
    label: NeighborhoodPreviewMobilePage-areaSheet;

    /* 높이는 퍼센트 대신 내용 높이를 따르고 더 키우지 않는다. 내용이 화면보다 길면 시트 안에서 스크롤한다. */
    &&[data-mode='default'] {
      height: auto;
    }

    & > button:first-of-type {
      height: 1.25rem;
    }

    & > header {
      padding-top: 0.1rem;
      padding-bottom: 0.4rem;
    }

    & > div:last-of-type {
      padding-bottom: 0.75rem;
    }
  `,

  reselect: css`
    position: fixed;
    z-index: 20;
    left: 50%;
    bottom: calc(var(--map-sheet-bottom, env(safe-area-inset-bottom)) + 0.75rem);
    transform: translateX(-50%);
    box-shadow: var(--shadow-floating);
    white-space: nowrap;
    /* 흰 지도와 시트 위에서도 눈에 띄게 진한 파랑 바탕에 굵은 테두리를 둔다. */
    border: 2px solid var(--color-surface);
    background: var(--color-brand-blue-ink);
    color: var(--color-on-primary);
    font-size: 0.875rem;

    &:hover:not(:disabled) {
      background: var(--color-brand-blue-ink);
    }

    &[data-public='true'] {
      bottom: calc(env(safe-area-inset-bottom) + 4.5rem);
    }

    & > span {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
  `,
  /* 시트 위 `floating` 칸 안에서는 위치를 시트가 정하므로 고정 배치만 푼다. */
  reselectFloating: css`
    label: NeighborhoodPreviewMobilePage-reselectFloating;
    position: static;
    transform: none;

    &[data-public='true'] {
      bottom: auto;
    }
  `,
  conditionCard: css`
    && {
      gap: 0.55rem;
    }
  `,
  headerSlider: css`
    pointer-events: auto;
    justify-self: center;
    align-self: center;
    width: min(100%, 15rem);
    padding: 0.4rem 0.75rem;
    border-radius: var(--radius-md);
    background: var(--color-surface);
    box-shadow: var(--shadow-floating);
  `,
  legendSlot: css`
    flex: 0 0 8.1rem;
    & > * {
      width: 100%;
    }
  `,
  legend: css`
    box-sizing: border-box;
  `,
  bookmark: css`
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-brand-blue-ink);
    font-size: 1.3rem;
    cursor: pointer;
  `,
  /* 시설 칸을 켰지만 멀리 보고 있을 때 지도 아래 가운데에 띄우는 한 줄 안내. 지도 조작을 막지 않는다. */
  zoomHint: css`
    label: NeighborhoodPreviewMobilePage-zoomHint;
    position: absolute;
    left: 50%;
    bottom: calc(env(safe-area-inset-bottom) + 1.5rem);
    z-index: 2;
    margin: 0;
    padding: 0.5rem 0.9rem;
    border-radius: 99px;
    background: var(--color-surface);
    box-shadow: 0 1px 6px rgb(0 0 0 / 8%);
    color: var(--color-ink-soft);
    font-size: 0.8rem;
    transform: translateX(-50%);
    pointer-events: none;
  `,

  /* 결과 머리. 첫 줄(집, 조건 요약, 다시 선택)과 둘째 줄(월세 슬라이더와 색 기준 카드)을 위아래로 쌓는다. */
  resultHeader: css`
    label: NeighborhoodPreviewMobilePage-resultHeader;

    && {
      pointer-events: none;
      flex-direction: column;
      align-items: stretch;
      gap: 0.45rem;
    }
  `,

  filterRow: css`
    label: NeighborhoodPreviewMobilePage-filterRow;
    pointer-events: none;
    display: flex;
    justify-content: flex-start;
    align-items: flex-start;
    gap: 0.45rem;
  `,

  resetButton: css`
    label: NeighborhoodPreviewMobilePage-resetButton;
    flex: none;
    display: grid;
    place-items: center;
    width: 2.75rem;
    height: 2.75rem;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: 50%;
    background: var(--color-surface);
    box-shadow: 0 1px 6px rgb(0 0 0 / 8%);
    color: var(--color-ink);
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 2px;
    }
  `,

  /* 막대만 있는 월세 슬라이더 카드. 지도 위에서도 읽히게 흰 바탕과 그림자를 둔다. */
  /* 월세 값은 눌러서 슬라이더를 여는 버튼이다. 파란 값으로 눌러 볼 수 있다는 걸 알린다. */
  /* 눌러서 슬라이더를 여는 버튼이라는 게 보이게 옅은 파랑 알약에 아래 화살표를 붙인다. 열리면 화살표가 뒤집힌다. */
  rentStat: css`
    label: NeighborhoodPreviewMobilePage-rentStat;
    display: inline-flex;
    align-items: center;
    gap: 0.15rem;
    padding: 0.15rem 0.45rem 0.15rem 0.6rem;
    border: 0;
    border-radius: 999px;
    background: #eef3fd;
    color: var(--color-brand-blue-ink);
    font: inherit;
    cursor: pointer;

    & svg {
      transition: transform 0.2s ease;
    }

    &[aria-expanded='true'] svg {
      transform: rotate(180deg);
    }

    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: 3px;
    }
  `,

  /* 시트가 없을 때: 하단 탭 위(`--map-sheet-bottom`) 오른쪽 아래. */
  locateCorner: css`
    label: NeighborhoodPreviewMobilePage-locateCorner;

    && {
      top: auto;
      right: 1rem;
      bottom: calc(var(--map-sheet-bottom, env(safe-area-inset-bottom, 0px)) + 0.75rem);
    }
  `,
  /* 출퇴근 장소를 고르는 조건 카드 위 오른쪽. 카드 안에 있어 카드 높이를 그대로 따른다. */
  locateAboveCard: css`
    label: NeighborhoodPreviewMobilePage-locateAboveCard;

    && {
      top: auto;
      right: 0.85rem;
      bottom: calc(100% + 0.75rem);
    }
  `,
  /* 시트 위 `floating` 칸 안에서는 위치를 시트가 정한다. 시트를 크게 열면 숨긴다. */
  locateDocked: cx(
    css`
      label: NeighborhoodPreviewMobilePage-locateDocked;
    `,
    hideWhenSheetExpanded,
  ),
  floatingRow: css`
    label: NeighborhoodPreviewMobilePage-floatingRow;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  `,
};

export default NeighborhoodPreviewMobilePage;
