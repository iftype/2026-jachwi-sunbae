import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { Outlet, useMatch } from 'react-router-dom';

import { useRecordsMapController } from '@/pages/design-records/RecordsMapProvider';
import RecordAddressSearch from '@/pages/design-records/ui/record-address-search/RecordAddressSearch';
import PropertyDetailPage from '@/pages/property-detail/PropertyDetailPage';
import { formatManwon } from '@/features/map/api/commuteApi';
import MapCanvas from '@/features/map/ui/map-canvas/MapCanvas';
import ExplorationRecordAction from '@/features/onboarding/ui/exploration-record-action/ExplorationRecordAction';
import MapHeaderWeather from '@/features/weather/ui/map-header-weather/MapHeaderWeather';
import { ROUTE_PATTERNS } from '@/shared/lib/navigation/appPaths';
import Icon from '@/shared/ui/icon/Icon';
import ListDetailLayout from '@/shared/ui/list-detail-layout/ListDetailLayout';
import MapBadgeRail from '@/shared/ui/map-badge-rail/MapBadgeRail';
import MapListHeader from '@/shared/ui/map-list-header/MapListHeader';
import { useMapPanel } from '@/shared/ui/map-list-header/MapPanelContext';
import StateIllustration from '@/shared/ui/state-illustration/StateIllustration';

import useNeighborhoodMapView from '../hooks/useNeighborhoodMapView';
import type { NeighborhoodPreviewContext } from '../hooks/useNeighborhoodPreview';
import useResultMapViewport from '../hooks/useResultMapViewport';
import { commuteColor } from '../model/commuteColors';
import { emptyAreaMessage, RESELECT_COMMUTE_LABEL } from '../model/criteriaLabels';
import { desktopMapViewport } from '../model/resultMapView';
import AnalysisOverlay from '../ui/analysis-overlay/AnalysisOverlay';
import CommuteLegend from '../ui/commute-legend/CommuteLegend';
import ConditionPanel from '../ui/condition-panel/ConditionPanel';
import FinderPropertyPanel from '../ui/finder-property-panel/FinderPropertyPanel';
import LocationControls from '../ui/location-controls/LocationControls';
import MapInfo, { type MapInfoSubject, mapInfoTitle } from '../ui/map-info/MapInfo';
import RentSlider from '../ui/rent-slider/RentSlider';

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
    // 동을 누르면 코너 정보 카드 대신 그 자리의 마커(소요시간, 월세 시세 포함)를 띄운다.
    showAreaAction: true,
  });
  const { isResultMap, mapProps, places, closeLayers } = mapView;
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
  const bookmark = preview.selected && mapView.bookmark(preview.selected.adminDongCode);
  // 지도 안 왼쪽 아래 카드에 보일 정보 하나: 누른 마커, 고른 동네, `My` 매물 목록 가운데 하나.
  // 동네 카드만 닫은 동네. 카드는 숨기되 지도의 선택 테두리는 남긴다. 다른 동네를 고르면 다시 카드를 보인다.
  // 조건 카드를 닫아 둔 상태. 새로 위치를 고르러 들어오면 다시 연다.
  const [isEditorHidden, setIsEditorHidden] = useState(false);
  useEffect(() => {
    if (preview.isSelectingOnMap) setIsEditorHidden(false);
  }, [preview.isSelectingOnMap]);
  // 내 매물은 지도 안 카드가 아니라 왼쪽 옆 칸(요약과 노선, 눌러서 상세)에 둔다.
  const infoSubject: MapInfoSubject | null =
    !isResultMap || !places.selectedPlace || places.selectedPlace.kind === 'property'
      ? null
      : { kind: 'place', place: places.selectedPlace };
  const { property } = mapView;
  const propertyDetail =
    isResultMap && property.selected !== null ? (
      property.isDetailOpen ? (
        <aside className={styles.propertyPanel} aria-label="선택한 매물 상세">
          <PropertyDetailPage
            key={property.selected.propertyId}
            panel={{ propertyId: property.selected.propertyId, onClose: property.closeDetail }}
          />
        </aside>
      ) : (
        <aside className={styles.propertyPanel} aria-label="내 매물 정보">
          <FinderPropertyPanel
            layout="split"
            property={property.selected}
            destination={preview.destination}
            route={property.route}
            commuteMaxMinutes={property.commuteMaxMinutes}
            onOpenDetail={property.openDetail}
            onDeleted={property.close}
          />
        </aside>
      )
    ) : undefined;
  /** 지도 안 정보 카드를 닫는다. */
  const closeInfo = () => {
    if (infoSubject?.kind === 'place') closeLayers();
    else mapView.clearRail();
  };
  const hasDetail = isResultMap && !!isDetailPage;

  // 로그인한 회원은 조건 카드를 지도 위가 아니라 왼쪽 목록 패널 맨 위에 붙여 둔다. 공개 탐색은 지도 위 카드를 그대로 쓴다.
  const isDocked = !preview.isPublicExplore;
  const editor = (
    <section
      className={isDocked ? styles.editorDocked : styles.editor}
      data-map-editor={isDocked ? undefined : true}
      aria-label="탐색 조건"
    >
      <ConditionPanel
        preview={preview}
        disabled={preview.isAnalyzing}
        onSubmit={submitSearch}
        // 월세는 여기서 고르지 않는다. 결과 지도의 월세 슬라이더에서 바로 조정한다.
        includeRent={false}
        canSubmit={preview.hasSearchChanges}
        // 이미 검색한 뒤에는 조건을 바꿨을 때만 `다시 검색`을 보인다. 바꾸지 않았으면 버튼 줄이 없다.
        showActions={!preview.hasSubmittedSearch || preview.hasSearchChanges}
        submitLabel={preview.hasSubmittedSearch ? '다시 검색' : '이 조건으로 동네 찾기'}
        headerAction={
          // 왼쪽 패널에 붙은 조건 카드는 접지 않는다. 지도 위에 뜨는 공개 탐색 카드만 잠깐 접을 수 있다.
          isDocked ? undefined : (
            <button
              className={styles.editorClose}
              type="button"
              aria-label="조건 접기"
              onClick={() => setIsEditorHidden(true)}
            >
              <Icon name="chevron-down" size={22} />
            </button>
          )
        }
      />
    </section>
  );
  const foundList = (
    <aside className={isDocked ? styles.areaPanelDocked : styles.areaPanel} aria-label="동네 찾기 결과">
      {!preview.isPublicExplore && (
        <MapListHeader className={isDocked ? undefined : styles.listHeader} center={<MapHeaderWeather />}>
          {/* 지도 검색: 고른 장소로 지도를 옮기고 검색 핀을 찍는다. 출퇴근 장소와 통근 분석은 바꾸지 않는다(출퇴근 장소는 아래 조건 칸에서 따로 정한다). */}
          <RecordAddressSearch onSelect={preview.searchTo} />
        </MapListHeader>
      )}
      {/* 탭이 바뀌면 지도는 함께 쓰고 왼쪽은 이 탭의 내용으로 바뀐다. 동네 찾기 탭은 조건 카드와 찾은 동네 목록이다. */}
      {isDocked && editor}
      {/* 로그인한 회원의 동네 찾기 왼쪽 패널은 조건만 두고, 찾은 동네는 지도 위 뱃지와 지도로 본다. 공개 탐색은 목록이 본문이라 그대로 둔다. */}
      {!isDocked && (
        <>
          <h2>찾은 동네</h2>
          {/* 이번 검색으로 받은 동네 카드를 통근 시간 짧은 순(같으면 출퇴근 장소에서 가까운 순)으로 늘어놓는다. */}
          {preview.resultAreas.length === 0 ? (
            <div className={styles.empty} role="status">
              <StateIllustration name="empty-search" size={7} />
              <p>
                {preview.hasSubmittedSearch
                  ? emptyAreaMessage(preview.maxRent)
                  : '지도에서 목적지와 조건을 선택해 주세요.'}
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
        </>
      )}
    </aside>
  );

  // 로그인한 회원은 지도 위에 찾은 동네 뱃지 줄을 둔다.
  const showsRecords = !preview.isPublicExplore && recordsController !== null;
  const list = foundList;

  return (
    <main className={`${shared.page} ${styles.page}`} data-public-explore={preview.isPublicExplore || undefined}>
      <ListDetailLayout
        list={panel ? panel.content : list}
        // 목록 옆 칸에는 동네 대중교통 상세만 연다. 장소, 동네, 내 매물 정보는 지도 안 왼쪽 아래 카드에 둔다.
        detail={panel ? undefined : (propertyDetail ?? (hasDetail ? <Outlet context={preview} /> : undefined))}
        onCloseDetail={propertyDetail ? property.close : preview.closeAreaDetails}
        closeLabel={propertyDetail ? '매물 정보 닫기' : '대중교통 상세 닫기'}
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
              trailing={
                bookmark && (
                  <button
                    type="button"
                    className={styles.bookmark}
                    aria-label={bookmark.isOn ? '찜한 동네에서 삭제' : '찜한 동네에 추가'}
                    aria-pressed={bookmark.isOn}
                    onClick={bookmark.onToggle}
                  >
                    {bookmark.isOn ? '★' : '☆'}
                  </button>
                )
              }
              // 출퇴근 장소를 다시 고르는 칩. 뱃지 줄 맨 앞에 고정해 둔다.
              leading={{
                label: RESELECT_COMMUTE_LABEL,
                onClick: () => {
                  closeLayers();
                  preview.selectRegion(null);
                  preview.editLocation();
                },
              }}
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
          {preview.isPublicExplore &&
            preview.isSelectingOnMap &&
            (isEditorHidden ? (
              <button className={styles.editorReopen} type="button" onClick={() => setIsEditorHidden(false)}>
                동네 찾기 조건
                <Icon name="chevron-up" size={22} />
              </button>
            ) : (
              editor
            ))}
          {preview.isSelectingOnMap && preview.isMapSelectionEnabled && (
            <div className={styles.selectHint} role="status">
              <span>지도를 눌러 출퇴근 장소를 골라요</span>
              <button type="button" onClick={preview.cancelMapSelection}>
                취소
              </button>
            </div>
          )}
          {preview.isSelectingOnMap && (
            <>
              <LocationControls
                preview={preview}
                isResult={false}
                className={styles.railControls}
                zoom={{ level: preview.selectionLevel, onZoom: preview.zoomSelectionBy }}
              />
            </>
          )}
          {isResultMap && (
            <>
              {/* 지도 안 왼쪽 아래: 위에 통근 시간 색 기준, 그 아래 월세 시세 슬라이더를 쌓는다. 동네를 찾은 뒤 슬라이더를 끌어 상한을 바꾸면, 받아 둔 결과에서 지도 색이 바로 바뀐다. */}
              <div className={styles.bottomStack}>
                {preview.hasSubmittedSearch && <CommuteLegend maxMinutes={preview.maxMinutes} />}
                <section className={styles.rentCard} aria-label="월세 시세 조건">
                  <RentSlider preview={preview} />
                </section>
              </div>

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
                    property={mapView.property}
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
  /* 옆 칸 안에서 위 요약과 아래 노선(또는 매물 상세)이 칸 높이를 채우고, 넘치면 안쪽에서 스크롤한다. */
  propertyPanel: css`
    label: NeighborhoodPreviewDesktopPage-propertyPanel;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
  `,

  bookmark: css`
    flex: none;
    min-width: 2.5rem;
    min-height: 2.5rem;
    border: 1px solid var(--color-border);
    border-radius: 50%;
    background: var(--color-surface);
    color: var(--color-brand-blue-ink);
    font-size: 1.1rem;
    cursor: pointer;
  `,
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
  /* 왼쪽 목록 패널 맨 위에 붙는 조건 카드. 지도 위에 띄우지 않고 목록 흐름 안에 둔다. */
  editorDocked: css`
    label: NeighborhoodPreviewDesktopPage-editorDocked;
    position: relative;
    display: flex;
    flex-direction: column;
    flex: none;
    gap: 0.75rem;
    padding: 0.9rem 0.85rem 1rem;
    border-bottom: 1px solid var(--color-border);
    background: white;
    & > aside {
      padding: 0;
      overflow: visible;
    }
  `,
  editorReopen: css`
    label: NeighborhoodPreviewDesktopPage-editorReopen;
    position: absolute;
    bottom: 1.25rem;
    right: 5.5rem;
    z-index: 35;
    /* 접어도 카드와 같은 가로 길이를 유지해, 접힌 카드라는 걸 보여 준다. */
    width: min(24rem, calc(100% - var(--map-panel-width, 0px) - 7rem));
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 3.25rem;
    padding: 0 1.25rem;
    border: 0;
    border-radius: 1rem;
    background: white;
    box-shadow: var(--shadow-floating);
    color: var(--color-ink);
    font: inherit;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
  `,
  editorClose: css`
    label: NeighborhoodPreviewDesktopPage-editorClose;
    flex: none;
    display: grid;
    width: 2.25rem;
    height: 2.25rem;
    place-items: center;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--color-muted);
    cursor: pointer;
  `,
  editor: css`
    label: NeighborhoodPreviewDesktopPage-editor;
    position: absolute;
    bottom: 1.25rem;
    right: 5.5rem;
    z-index: 35;
    width: min(24rem, calc(100% - var(--map-panel-width, 0px) - 7rem));
    max-height: calc(100% - 9rem);
    border-radius: 1rem;
    background: white;
    box-shadow: var(--shadow-floating);
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
    /* 안쪽 조건 칸(aside)은 여백을 이 카드가 대신 준다. */
    padding: 1.1rem 1.25rem 1.25rem;
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
    left: calc(var(--map-panel-width, 0px) + 18rem);
    z-index: 32;
    display: grid;
    gap: 0.6rem;
    width: min(22rem, max(10rem, calc(100% - var(--map-panel-width, 0px) - 52rem)));
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
    /* 상세 닫기 버튼은 지도 왼쪽 위 월세 필터 아래에 둔다. */
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

  /* 왼쪽 패널에 조건 카드를 붙이는 회원용. 패널 바깥 여백을 두지 않고 안쪽 카드가 자기 여백만 갖는다. */
  /* 동네를 찾은 뒤 지도 왼쪽 위(뱃지 줄 아래)에 띄우는 월세 시세 슬라이더 카드. */
  selectHint: css`
    label: NeighborhoodPreviewDesktopPage-selectHint;
    position: absolute;
    top: 1rem;
    left: 50%;
    z-index: 33;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.6rem 0.5rem 0.9rem;
    border-radius: 999px;
    background: var(--color-brand-blue-ink);
    box-shadow: var(--shadow-floating);
    color: #fff;
    font-size: 0.85rem;
    font-weight: 700;
    transform: translateX(-50%);

    & button {
      padding: 0.2rem 0.7rem;
      border: 0;
      border-radius: 999px;
      background: #fff;
      color: var(--color-brand-blue-ink);
      font: inherit;
      font-size: 0.78rem;
      font-weight: 800;
      cursor: pointer;
    }
  `,
  /* 지도 왼쪽 아래에 색 기준(위)과 월세 슬라이더(아래)를 쌓는다. 오른쪽 정보 카드는 이 줄 옆으로 비킨다. */
  bottomStack: css`
    label: NeighborhoodPreviewDesktopPage-bottomStack;
    position: absolute;
    z-index: 31;
    bottom: 1.25rem;
    left: calc(var(--map-panel-width, 0px) + 1rem);
    display: grid;
    gap: 0.6rem;
    justify-items: start;
    width: 16rem;
    pointer-events: none;
  `,
  rentCard: css`
    label: NeighborhoodPreviewDesktopPage-rentCard;
    box-sizing: border-box;
    width: 16rem;
    padding: 0.75rem 1rem 0.9rem;
    border-radius: 1rem;
    background: white;
    box-shadow: var(--shadow-floating);
    pointer-events: auto;
  `,

  areaPanelDocked: css`
    label: NeighborhoodPreviewDesktopPage-areaPanelDocked;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
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
      right: 1.15rem;
    }
  `,

  recordAction: css`
    label: NeighborhoodPreviewDesktopPage-recordAction;
    right: auto;
    width: min(24rem, calc(100% - 2rem));
  `,
};

export default NeighborhoodPreviewDesktopPage;
