import { css } from '@emotion/css';
import { useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';

import DesignRecordsPage from '@/pages/design-records/DesignRecordsPage';
import useRecordsView from '@/pages/design-records/hooks/useRecordsView';
import { RecordsMapProvider } from '@/pages/design-records/RecordsMapProvider';
import NeighborhoodPreviewPage from '@/pages/neighborhood-preview/NeighborhoodPreviewPage';
import { FacilityFocusProvider } from '@/features/map/hooks/useFacilityFocus';
import { MapCanvasMode, SharedMapCanvasProvider } from '@/features/map/ui/map-canvas/SharedMapCanvas';
import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';
import { CHEAP_MEALS_PATH, MY_PATH, NEIGHBORHOODS_PATH, RECORDS_PATH } from '@/shared/lib/navigation/appPaths';
import MobileBottomTabs from '@/shared/ui/bottom-tab-bar/MobileBottomTabs';
import { MapPanelProvider } from '@/shared/ui/map-list-header/MapPanelContext';
import { MapModeProvider, type MapModeSwitch } from '@/shared/ui/map-mode-tile/MapModeContext';
import NavRail from '@/shared/ui/nav-rail/NavRail';
import { NAV_RAIL_ITEMS } from '@/shared/ui/nav-rail/navRailItems';

import MyMapPanel from './ui/MyMapPanel';

/** 지도 화면 왼쪽 레일. */
const UnifiedNavRail = ({
  pathname,
  isMy,
  isFinding,
  isMeals,
  onRecords,
  onFinding,
  onMy,
  onTool,
}: {
  pathname: string;
  isMy: boolean;
  isFinding: boolean;
  isMeals: boolean;
  onRecords: () => void;
  onFinding: () => void;
  onMy: () => void;
  onTool: (path: string) => void;
}) => {
  return (
    <NavRail
      label="화면 이동"
      items={NAV_RAIL_ITEMS.map((item) => ({
        ...item,
        isActive:
          (item.key === 'records' && !isMy && !isFinding && !isMeals) ||
          (item.key === 'neighborhoods' && !isMy && isFinding) ||
          (item.key === 'my' && isMy) ||
          (item.path !== undefined && isMeals && pathname.startsWith(item.path)),
        onSelect: () => {
          if (item.key === 'records') onRecords();
          else if (item.key === 'neighborhoods') onFinding();
          else if (item.key === 'my') onMy();
          else if (item.path !== undefined) onTool(item.path);
        },
      }))}
    />
  );
};

const UnifiedMapPage = () => {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const [recordsView] = useRecordsView();
  const params = useParams();
  const isMy = pathname === MY_PATH;
  const [lastFinding, setLastFinding] = useState(pathname.startsWith(NEIGHBORHOODS_PATH));
  // 저렴한 한 끼도 이 화면 안에서 그린다. 지도 인스턴스와 줌, 중심이 내 기록, 동네 찾기와 이어진다.
  const isMeals = pathname.startsWith(CHEAP_MEALS_PATH);
  const isFinding = isMy ? lastFinding : pathname.startsWith(NEIGHBORHOODS_PATH);
  if (!isMy && lastFinding !== isFinding) setLastFinding(isFinding);
  const [recordsUrl, setRecordsUrl] = useState(RECORDS_PATH);
  const [findingUrl, setFindingUrl] = useState(NEIGHBORHOODS_PATH);
  const currentUrl = pathname + search;
  if (!isMy && isFinding && findingUrl !== currentUrl) setFindingUrl(currentUrl);
  if (!isMy && !isFinding && !isMeals && recordsUrl !== currentUrl) setRecordsUrl(currentUrl);
  const isMobileDetail = !isDesktop && !isFinding && params.propertyId !== undefined;
  const closeMy = () => navigate(isFinding ? findingUrl : recordsUrl);
  // 동네 찾기로 넘어갈 때는 지난 검색(목적지, 조건, 결과)이 있으면 그 화면으로, 처음이면 동네 찾기 지도로 바로 간다.
  // 따로 검색 화면을 거치지 않고, 지도에서 출퇴근 장소를 고르거나 검색하게 한다.
  const toFinding: MapModeSwitch = {
    target: 'neighborhoods',
    onSwitch: () => navigate(findingUrl),
  };
  const toRecords: MapModeSwitch = { target: 'records', onSwitch: () => navigate(recordsUrl) };
  const panel = isMy ? { content: <MyMapPanel onClose={closeMy} />, close: closeMy } : null;
  return (
    <FacilityFocusProvider>
      <RecordsMapProvider>
        <SharedMapCanvasProvider
          preserveZoomOnModeChange
          infrastructure={{
            open: !isFinding && !isMeals && (isDesktop || recordsView === 'map'),
            onClose: () => undefined,
          }}
        >
          <div className={styles.page} data-desktop={isDesktop}>
            {isDesktop && (
              <UnifiedNavRail
                pathname={pathname}
                isMeals={isMeals}
                isMy={isMy}
                isFinding={isFinding}
                onRecords={toRecords.onSwitch}
                onFinding={toFinding.onSwitch}
                onMy={() => navigate(MY_PATH)}
                onTool={(path) => navigate(path)}
              />
            )}
            <div className={styles.content}>
              <div
                hidden={isFinding || isMobileDetail || isMeals}
                className={styles.screen}
                data-mobile={!isDesktop || undefined}
              >
                <MapCanvasMode active={!isFinding && !isMobileDetail && !isMeals}>
                  <MapPanelProvider value={isMy && !isFinding ? panel : null}>
                    <MapModeProvider value={toFinding}>
                      <DesignRecordsPage />
                    </MapModeProvider>
                  </MapPanelProvider>
                </MapCanvasMode>
              </div>
              <div hidden={!isFinding || isMeals} className={styles.screen} data-mobile={!isDesktop || undefined}>
                <MapCanvasMode active={isFinding}>
                  <MapPanelProvider value={isMy && isFinding ? panel : null}>
                    <MapModeProvider value={toRecords}>
                      <NeighborhoodPreviewPage />
                    </MapModeProvider>
                  </MapPanelProvider>
                </MapCanvasMode>
              </div>
              {isMeals && (
                <div className={styles.screen} data-mobile={!isDesktop || undefined}>
                  <MapCanvasMode active>
                    <Outlet />
                  </MapCanvasMode>
                </div>
              )}
              {isMobileDetail && (
                <div className={styles.detail}>
                  <Outlet />
                </div>
              )}
            </div>
            {!isDesktop && <MobileBottomTabs recordsTo={recordsUrl} neighborhoodsTo={findingUrl} />}
          </div>
        </SharedMapCanvasProvider>
      </RecordsMapProvider>
    </FacilityFocusProvider>
  );
};
const styles = {
  detail: css`
    label: UnifiedMapPage-detail;
    height: 100%;
    overflow-y: auto;
  `,
  page: css`
    label: UnifiedMapPage-page;
    position: relative;
    height: 100dvh;
    overflow: hidden;
    /* 휴대폰 하단 탭이 보이는 동안 아래 요소(시트, 스위치, 배너, 버튼)를 탭 높이만큼 올린다. 값은 탭 바가 html에 거는 --mobile-tab-space 하나다. */
    --map-mode-bottom: var(--mobile-tab-space, 0px);
    --map-sheet-bottom: var(--mobile-tab-space);
    --map-profile-space: 0px;
    /* 네이버 지도가 아래에 직접 붙이는 로고와 저작권, 축척 표시도 하단 탭 위로 올린다. 지도가 인라인 bottom으로 놓으므로 덮어쓴다. */
    & [class*='MapCanvas-liveLayer'] [style*='bottom: 0px'] {
      bottom: var(--mobile-tab-space, 0px) !important;
    }
    &[data-desktop='true'] {
      display: grid;
      grid-template-columns: 76px minmax(0, 1fr);
      --unified-panel-top: 0px;
      --map-mode-bottom: 0px;
      --map-profile-space: 0px;
      & [class*='MapCanvas-liveLayer'] [style*='bottom: 0px'] {
        bottom: 0 !important;
      }
    }
  `,
  content: css`
    label: UnifiedMapPage-content;
    position: relative;
    min-width: 0;
    height: 100%;
  `,
  screen: css`
    label: UnifiedMapPage-screen;
    height: 100%;
    box-sizing: border-box;

    &[hidden] {
      display: none;
    }
  `,
};
export default UnifiedMapPage;
