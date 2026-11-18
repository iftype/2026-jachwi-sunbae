import { css } from '@emotion/css';
import { useState } from 'react';
import { Outlet, useMatch } from 'react-router-dom';

import { useRecordsMapController } from '@/pages/design-records/RecordsMapProvider';
import RecordList from '@/pages/design-records/ui/record-list/RecordList';
import RecordLoadError from '@/pages/design-records/ui/record-load-error/RecordLoadError';
import { formatManwon } from '@/features/map/api/commuteApi';
import MapCanvas from '@/features/map/ui/map-canvas/MapCanvas';
import MapCategoryRail from '@/features/map/ui/map-category-rail/MapCategoryRail';
import ExplorationRecordAction from '@/features/onboarding/ui/exploration-record-action/ExplorationRecordAction';
import MapHeaderWeather from '@/features/weather/ui/map-header-weather/MapHeaderWeather';
import { ROUTE_PATTERNS } from '@/shared/lib/navigation/appPaths';
import AreaSkeleton from '@/shared/ui/area-skeleton/AreaSkeleton';
import { Button } from '@/shared/ui/button/Button';
import Icon from '@/shared/ui/icon/Icon';
import ListDetailLayout from '@/shared/ui/list-detail-layout/ListDetailLayout';
import MapBadgeRail from '@/shared/ui/map-badge-rail/MapBadgeRail';
import MapListHeader from '@/shared/ui/map-list-header/MapListHeader';
import { useMapPanel } from '@/shared/ui/map-list-header/MapPanelContext';
import StateIllustration from '@/shared/ui/state-illustration/StateIllustration';

import useNeighborhoodMapView from '../hooks/useNeighborhoodMapView';
import type { NeighborhoodPreviewContext } from '../hooks/useNeighborhoodPreview';
import useResultMapViewport from '../hooks/useResultMapViewport';
import {
  COMMUTE_COLORS,
  commuteColor,
  commuteLegend,
  NO_RENT_COLOR,
  NO_RENT_LEGEND_LABEL,
} from '../model/commuteColors';
import { emptyAreaMessage } from '../model/criteriaLabels';
import { desktopMapViewport } from '../model/resultMapView';
import AnalysisOverlay from '../ui/analysis-overlay/AnalysisOverlay';
import ConditionPanel from '../ui/condition-panel/ConditionPanel';
import LocationControls from '../ui/location-controls/LocationControls';
import MapInfo, { type MapInfoSubject, mapInfoTitle } from '../ui/map-info/MapInfo';
import NeighborhoodMapSearch from '../ui/map-search/NeighborhoodMapSearch';
import MapTapHint from '../ui/map-tap-hint/MapTapHint';

import * as shared from '../NeighborhoodPreviewPage.styles';

type Props = {
  preview: NeighborhoodPreviewContext;
};

/**
 * 데스크탑 동네 찾기. 본 방 기록처럼 왼쪽 칸에서 조작하고 지도는 오른쪽에 둔다.
 * 고를 때는 왼쪽 칸에 조건을, 결과에서는 기준 요약과 상위 동네를 두고, 대중교통 상세는 목록 옆 칸에 붙여 연다.
 */
const NeighborhoodPreviewDesktopPage = ({ preview }: Props) => {
  const panel = useMapPanel();
  const recordsController = useRecordsMapController();
  const isRoutePage = useMatch(`${preview.mapPath}/${ROUTE_PATTERNS.area}/*`);
  const isDetailPage = useMatch(`${preview.mapPath}/${ROUTE_PATTERNS.areaDetails}`);
  const submitSearch = preview.startAnalysis;
  const mapView = useNeighborhoodMapView(preview, {
    showAreaAction: false,
  });
  const { isResultMap, mapProps, places, closeLayers, rail, railSelection } = mapView;
  // 지도 칸은 목록, 상세 칸 오른쪽에 있다. 상세 칸이 아직 닫혀 있으면 고른 뒤 열릴 폭을 미리 빼고 시점을 맞춘다.
  const mapSectionRef = useResultMapViewport<HTMLElement>(preview, (section) => {
    const layout = section.parentElement?.parentElement;
    if (!preview.isPublicExplore && layout) {
      const rect = section.getBoundingClientRect();
      const info = section.querySelector('[data-map-info]')?.getBoundingClientRect();
      const editor = section.querySelector('[data-map-editor]')?.getBoundingClientRect();
      const panelWidth = getComputedStyle(layout).getPropertyValue('--map-panel-width');
      const panel = layout.firstElementChild?.getBoundingClientRect();
      const detail = layout.dataset.detailOpen === 'true' ? layout.children[1]?.getBoundingClientRect() : null;
      if (panelWidth && panel)
        return {
          width: rect.width,
          height: rect.height,
          padding: {
            top: 88,
            right: Math.max(88, info ? rect.right - info.left + 16 : 0, editor ? rect.right - editor.left + 16 : 0),
            bottom: 48,
            left: (detail?.right ?? panel.right) - rect.left + 24,
          },
        };
    }
    return desktopMapViewport(section.getBoundingClientRect(), {
      width: layout?.getBoundingClientRect().width ?? window.innerWidth,
      isDetailOpen: layout?.dataset.detailOpen === 'true',
    });
  });
  const recordArea = preview.selected ?? preview.topAreas[0];
  // 지도 안 왼쪽 아래 카드에 보일 정보 하나: 누른 마커, 고른 동네, `My` 매물 목록 가운데 하나.
  // 동네 카드만 닫은 동네. 카드는 숨기되 지도의 선택 테두리는 남긴다. 다른 동네를 고르면 다시 카드를 보인다.
  const [closedAreaId, setClosedAreaId] = useState<string | null>(null);
  const infoSubject: MapInfoSubject | null = !isResultMap
    ? null
    : places.selectedPlace
      ? { kind: 'place', place: places.selectedPlace }
      : preview.selected && preview.selected.adminDongCode !== closedAreaId
        ? { kind: 'area', area: preview.selected }
        : railSelection === 'MY'
          ? { kind: 'my' }
          : null;
  /** 지도 안 정보 카드를 닫는다. */
  const closeInfo = () => {
    if (infoSubject?.kind === 'place') closeLayers();
    else if (infoSubject?.kind === 'area') setClosedAreaId(infoSubject.area.adminDongCode);
    else mapView.clearRail();
  };
  const hasDetail = isResultMap && !!isDetailPage;

  const editor = (
    <section className={styles.editor} data-map-editor aria-label="지도 위 탐색 조건">
      {preview.isPublicExplore && <NeighborhoodMapSearch preview={preview} />}
      <ConditionPanel
        preview={preview}
        disabled={preview.isAnalyzing}
        onSubmit={submitSearch}
        includeRent={!preview.isPublicExplore}
        canSubmit={preview.hasSearchChanges}
        submitLabel={preview.hasSubmittedSearch ? '다시 검색' : '이 조건으로 동네 찾기'}
      />
      <div className={styles.editorLegend} aria-label="통근 시간 색상 기준">
        {commuteLegend(preview.maxMinutes).map(([group, label]) => (
          <span key={group}>
            <i style={{ background: COMMUTE_COLORS[group].fillColor }} />
            {label}
          </span>
        ))}
        <span>
          <i
            style={{
              background: 'rgb(134 139 148 / 28%)',
              border: `1.5px dashed ${NO_RENT_COLOR.strokeColor}`,
              boxSizing: 'border-box',
            }}
          />
          {NO_RENT_LEGEND_LABEL}
        </span>
      </div>
      {preview.hasSubmittedSearch && (
        <Button variant="secondary" aria-pressed={preview.areRegionsVisible} onClick={preview.toggleRegions}>
          {preview.areRegionsVisible ? '행정동 숨기기' : '행정동 표시하기'}
        </Button>
      )}
    </section>
  );
  const foundList = (
    <aside className={styles.areaPanel} aria-label="동네 찾기 결과">
      {!preview.isPublicExplore && (
        <MapListHeader className={styles.listHeader} center={<MapHeaderWeather />}>
          <NeighborhoodMapSearch preview={preview} hideHome />
        </MapListHeader>
      )}
      <h2>찾은 동네</h2>
      {/* 이번 검색으로 받은 동네 카드를 통근 시간 짧은 순(같으면 출퇴근 장소에서 가까운 순)으로 늘어놓는다. */}
      {preview.resultAreas.length === 0 ? (
        <div className={styles.empty} role="status">
          <StateIllustration name="empty-search" size={7} />
          <p>
            {preview.hasSubmittedSearch ? emptyAreaMessage(preview.maxRent) : '지도에서 목적지와 조건을 선택해 주세요.'}
          </p>
        </div>
      ) : (
        <ul className={styles.areaList} aria-label="찾은 동네 목록">
          {preview.resultAreas.map((area) => (
            <li key={area.adminDongCode}>
              {/* 카드를 누르면 지도를 그 행정동으로 옮기고 그 동네를 고른다. 목록은 그대로 두고 고른 카드만 표시한다. */}
              <button
                type="button"
                aria-pressed={preview.selected?.adminDongCode === area.adminDongCode}
                onClick={() => {
                  closeLayers();
                  preview.selectRegion(area.adminDongCode, { openDetails: false, focus: 'area' });
                }}
              >
                <span>
                  <strong>{area.name}</strong>
                  <small>{area.rent ? `월세 ${formatManwon(area.rent.monthlyRentKrw)}` : '시세 없음'}</small>
                </span>
                <b>{area.commuteMinutes}분</b>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );

  const showsRecords = !preview.isPublicExplore && recordsController !== null;
  const records = recordsController?.records;
  const list =
    showsRecords && records ? (
      <aside className={styles.areaPanel} aria-label="내 매물 기록">
        <MapListHeader className={styles.listHeader} center={<MapHeaderWeather />}>
          <NeighborhoodMapSearch preview={preview} hideHome />
        </MapListHeader>
        {records.properties.isPending ? (
          <AreaSkeleton area="list" label="기록을 불러오는 중이에요." />
        ) : records.properties.isError ? (
          <RecordLoadError error={records.properties.error} onRetry={() => void records.properties.refetch()} />
        ) : (
          <RecordList
            className={styles.recordList}
            records={records.records}
            district={records.district}
            onOpen={records.showRecord}
            onNotice={records.setNotice}
          />
        )}
      </aside>
    ) : (
      foundList
    );

  return (
    <main className={`${shared.page} ${styles.page}`} data-public-explore={preview.isPublicExplore || undefined}>
      <ListDetailLayout
        list={panel ? panel.content : list}
        // 목록 옆 칸에는 동네 대중교통 상세만 연다. 장소, 동네, 내 매물 정보는 지도 안 왼쪽 아래 카드에 둔다.
        detail={!panel && hasDetail ? <Outlet context={preview} /> : undefined}
        onCloseDetail={preview.closeAreaDetails}
        closeLabel="대중교통 상세 닫기"
      >
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
          {isResultMap && showsRecords && (
            <MapBadgeRail
              desktopMap
              overMap
              label="찾은 동네"
              items={preview.resultAreas.map((area) => ({
                id: area.adminDongCode,
                label: area.name,
                value: `${area.commuteMinutes}분`,
                valueColor: commuteColor(area.commuteMinutes).fillColor,
              }))}
              selectedId={preview.selected?.adminDongCode ?? null}
              onSelect={(id) => {
                closeLayers();
                preview.selectRegion(id, { openDetails: false, focus: 'area' });
              }}
            />
          )}
          {(!preview.isPublicExplore || preview.isSelectingOnMap) && editor}
          {preview.isSelectingOnMap && (
            <>
              <LocationControls
                preview={preview}
                isResult={false}
                className={styles.railControls}
                zoom={{ level: preview.selectionLevel, onZoom: preview.zoomSelectionBy }}
              />
              {preview.isMapSelectionEnabled &&
                !preview.hasChosenMapPoint &&
                !preview.query.trim() &&
                preview.addressResults.length === 0 && <MapTapHint />}
            </>
          )}
          {isResultMap && (
            <>
              {/* 지도 안 왼쪽 위: 월세 시세 슬라이더와 지도 색 기준. 끄는 동안 지도 색과 왼쪽 목록이 바로 바뀐다. */}

              {/* 지도 안 왼쪽 아래: 지도에서 누른 마커(또는 지도에서 고른 동네, My 목록) 정보 카드. */}
              {infoSubject && (
                <section data-map-info className={styles.info} aria-label={mapInfoTitle(infoSubject)}>
                  <header>
                    <h3>{mapInfoTitle(infoSubject)}</h3>
                    <button type="button" aria-label="정보 닫기" onClick={closeInfo}>
                      <Icon name="close" size={20} />
                    </button>
                  </header>
                  <MapInfo
                    subject={infoSubject}
                    preview={preview}
                    my={mapView.my}
                    onSelectProperty={mapView.selectMyProperty}
                    phoneAction="copy"
                  />
                </section>
              )}
              {/* 결과에 들어오자마자 예전 본 방 기록 지도처럼 오른쪽 위에 확대 축소, 분류 레일, 현재 위치 버튼을 한 줄로 세운다. */}
              <LocationControls
                preview={preview}
                isResult
                zoom={{ level: preview.resultLevel, onZoom: preview.zoomResultBy }}
                className={styles.railControls}
                rail={<MapCategoryRail showIcons={false} {...rail} />}
              />
              {preview.isPublicExplore && recordArea && (
                <div className={`${shared.recordAction} ${styles.recordAction}`}>
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
              {/* 동네만 고른 주소(`areas/:code`)는 화면을 그리지 않고, 저장된 검색이 없을 때의 안내만 맡는다. */}
              {isRoutePage && !isDetailPage && <Outlet context={preview} />}
            </>
          )}
        </section>
      </ListDetailLayout>
    </main>
  );
};

const styles = {
  recordList: css`
    label: NeighborhoodPreviewDesktopPage-recordList;
    min-height: 0;
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
  `,
  listHeader: css`
    label: NeighborhoodPreviewDesktopPage-listHeader;
    width: calc(100% + 3rem);
    margin: -1.25rem -1.5rem 0;
  `,
  editorLegend: css`
    label: NeighborhoodPreviewDesktopPage-editorLegend;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.65rem;
    color: var(--color-muted);
    font-size: 0.7rem;
    font-weight: 700;
    & span {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }
    & i {
      width: 3px;
      height: 0.7rem;
      border-radius: 1px;
    }
  `,
  editor: css`
    label: NeighborhoodPreviewDesktopPage-editor;
    position: absolute;
    bottom: 1.25rem;
    right: 5.5rem;
    z-index: 35;
    width: min(24rem, calc(100% - var(--map-panel-width, 0px) - 7rem));
    max-height: calc(100% - 7rem);
    border-radius: 1rem;
    background: white;
    box-shadow: var(--shadow-floating);
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
    padding: 1rem;
    gap: 0.75rem;
    & > aside {
      padding: 0;
      overflow: visible;
    }
  `,
  /* 지도 안 왼쪽 아래 마커 정보 카드. 길면 카드 안에서 스크롤한다. */
  info: css`
    label: NeighborhoodPreviewDesktopPage-info;
    position: absolute;
    bottom: 1.25rem;
    left: calc(var(--map-panel-width, 0px) + 2rem);
    z-index: 32;
    display: grid;
    gap: 0.6rem;
    width: min(22rem, max(10rem, calc(100% - var(--map-panel-width, 0px) - 34rem)));
    max-height: calc(100% - 13rem);
    overflow-y: auto;
    padding: 0.9rem 1rem;
    border: 1px solid var(--color-border);
    border-radius: 1rem;
    background: var(--color-surface);
    box-shadow: 0 0.2rem 0.8rem rgb(0 0 0 / 8%);

    & > header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.4rem;
    }

    & > header h3 {
      margin: 0;
      overflow: hidden;
      font-size: 1rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    & > header button {
      flex: none;
      display: grid;
      place-items: center;
      width: 2rem;
      height: 2rem;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: none;
      color: var(--color-ink-soft);
      cursor: pointer;
    }
  `,

  /* 동네 카드 목록. 남은 높이를 채우고 안에서 스크롤한다. 고른 카드는 테두리와 바탕으로 표시한다. */
  areaList: css`
    label: NeighborhoodPreviewDesktopPage-areaList;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: grid;
    align-content: start;
    margin: 0 -1.5rem;
    padding: 0 0 0.25rem;
    list-style: none;
    & li {
      border-bottom: 1px solid var(--color-border);
    }
    & button {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      width: 100%;
      padding: 0.75rem 1.5rem;
      border: 0;
      background: transparent;
      color: var(--color-ink);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    & button:hover,
    & button[aria-pressed='true'] {
      background: var(--color-surface-muted);
    }
    & button:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: -2px;
    }
    & span {
      display: flex;
      flex: 1;
      align-items: baseline;
      gap: 0.75rem;
      min-width: 0;
    }
    & strong {
      overflow: hidden;
      font-size: 0.95rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    & small {
      color: var(--color-muted);
      font-size: 0.78rem;
    }
    & b {
      flex: none;
      color: var(--color-brand-blue-ink);
      font-size: 0.8rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
  `,

  zoomHint: css`
    label: NeighborhoodPreviewDesktopPage-zoomHint;
    position: absolute;
    bottom: 5rem;
    left: 50%;
    z-index: 31;
    margin: 0;
    padding: 0.5rem 0.9rem;
    border-radius: 99px;
    background: var(--color-surface);
    box-shadow: var(--shadow-floating);
    color: var(--color-ink-soft);
    font-size: 0.8rem;
    transform: translateX(-50%);
    pointer-events: none;
  `,

  /* 데스크탑 동네 찾기. 공용 틀(NeighborhoodPreviewPage.module.css) 위에 덧씌운다. */
  page: css`
    label: NeighborhoodPreviewDesktopPage-page;
    /* 상세 닫기 버튼은 지도 왼쪽 위 월세 필터 아래에 둔다. */
    --list-detail-close-top: 9.5rem;
    overflow: hidden;
    &[data-public-explore='true'] {
      --unified-panel-content-top: 1rem;
    }
  `,

  /* 왼쪽 칸. 머리 아래에 동네 목록만 두고, 목록이 남은 높이를 채운다. */
  areaPanel: css`
    label: NeighborhoodPreviewDesktopPage-areaPanel;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    min-height: 0;
    overflow: hidden;
    padding: 1.25rem 1.5rem;
    & > h2 {
      margin: 0;
      font-size: 1.1rem;
    }
  `,

  areaHeader: css`
    label: NeighborhoodPreviewDesktopPage-areaHeader;
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;

    & h2 {
      margin: 0;
      font-size: 1.1rem;
      letter-spacing: -0.02em;
    }

    & p {
      margin: 0;
    }
  `,

  /* 윗줄: 출퇴근 장소. 아랫줄보다 진하고 조금 크게 둔다. */
  areaDestination: css`
    label: NeighborhoodPreviewDesktopPage-areaDestination;
    margin-top: 0.35rem;
    color: var(--color-ink);
    font-size: 0.88rem;
    font-weight: 600;
    /* 좁은 칸에서 주소 끝이 말줄임으로 잘리지 않게 두 줄까지 늘린다. */
    word-break: keep-all;
  `,

  /* 아랫줄: 필터링 조건. 옅은 회색 작은 글씨. */
  areaCriteria: css`
    label: NeighborhoodPreviewDesktopPage-areaCriteria;
    margin-top: 0.15rem;
    color: var(--color-muted);
    font-size: 0.78rem;
  `,

  /* 지도 색 기준. 한 줄로 이름 아래에 둔다. */
  areaLegend: css`
    label: NeighborhoodPreviewDesktopPage-areaLegend;
    display: flex;
    flex-wrap: wrap;
    flex-basis: 100%;
    gap: 0.3rem 0.9rem;
    margin-top: -0.2rem;
    color: var(--color-ink-soft);
    font-size: 0.72rem;
    font-weight: 700;

    & span {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
    }

    & i {
      width: 3px;
      height: 0.65rem;
      flex: none;
      border-radius: 1px;
    }
  `,

  reselect: css`
    label: NeighborhoodPreviewDesktopPage-reselect;
    flex: none;
    padding: 0.45rem 0.7rem;
    font-size: 0.75rem;
    white-space: nowrap;

    & > span {
      gap: 0.3rem;
    }
  `,

  empty: css`
    label: NeighborhoodPreviewDesktopPage-empty;
    display: grid;
    gap: 0.75rem;
    margin: 1.5rem 0 0;
    color: var(--color-ink-soft);
    font-size: 0.9rem;
    text-align: center;

    & p {
      margin: 0;
    }
  `,

  /* 월세 필터 안 색 기준 줄. 필터가 흰 바탕이라 따로 바탕을 두지 않는다. */
  /* 지도 안 왼쪽 위 월세 슬라이더와 색 기준. 오른쪽 위 버튼 줄과 겹치지 않게 폭을 둔다. */

  /* 지도 오른쪽 위. 왼쪽 위 색상 기준 상자와 같은 높이에서 시작한다. */
  railControls: css`
    label: NeighborhoodPreviewDesktopPage-railControls;

    && {
      top: 4.75rem;
    }
  `,

  recordAction: css`
    label: NeighborhoodPreviewDesktopPage-recordAction;
    right: auto;
    width: min(24rem, calc(100% - 2rem));
  `,
};

export default NeighborhoodPreviewDesktopPage;
