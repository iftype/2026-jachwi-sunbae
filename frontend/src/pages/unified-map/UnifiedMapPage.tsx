import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';

import DesignRecordsPage from '@/pages/design-records/DesignRecordsPage';
import useRecordsView from '@/pages/design-records/hooks/useRecordsView';
import { RecordsMapProvider, useRecordsMapController } from '@/pages/design-records/RecordsMapProvider';
import {
  neighborhoodSearchKey,
  readNeighborhoodSearch,
} from '@/pages/neighborhood-preview/model/neighborhoodSearchSession';
import NeighborhoodPreviewPage from '@/pages/neighborhood-preview/NeighborhoodPreviewPage';
import { MapCanvasMode, SharedMapCanvasProvider } from '@/features/map/ui/map-canvas/SharedMapCanvas';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';
import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';
import {
  MY_PATH,
  NEIGHBORHOOD_ADDRESS_SEARCH_PATH,
  NEIGHBORHOODS_PATH,
  RECORDS_PATH,
} from '@/shared/lib/navigation/appPaths';
import { MapPanelProvider } from '@/shared/ui/map-list-header/MapPanelContext';
import { MapModeProvider, type MapModeSwitch } from '@/shared/ui/map-mode-tile/MapModeContext';
import NavRail from '@/shared/ui/nav-rail/NavRail';
import { NAV_RAIL_ITEMS } from '@/shared/ui/nav-rail/navRailItems';

import MyMapPanel from './ui/MyMapPanel';

/** 지도 화면 왼쪽 레일. 기록 지도 컨트롤러(`본 방 기록하기`)를 쓰려고 `RecordsMapProvider` 안에 둔다. */
const UnifiedNavRail = ({
  isMy,
  isFinding,
  onRecords,
  onFinding,
  onMy,
  onTool,
}: {
  isMy: boolean;
  isFinding: boolean;
  onRecords: () => void;
  onFinding: () => void;
  onMy: () => void;
  onTool: (path: string) => void;
}) => {
  const controller = useRecordsMapController();
  // 동네 찾기나 마이에서 `본 방 기록하기`를 누르면 먼저 기록 지도로 돌아온 뒤, 지도가 이어받은 시점이 자리 잡고 나서 말풍선을 연다.
  // 바로 열면 기록 지도의 옛 가운데에 열려 지금 보던 자리와 달라진다.
  const [wantsRegister, setWantsRegister] = useState(false);
  useEffect(() => {
    if (!wantsRegister || isFinding || isMy) return;
    const timer = window.setTimeout(() => {
      controller?.layers.startRegister?.();
      setWantsRegister(false);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [wantsRegister, isFinding, isMy, controller]);
  return (
    <NavRail
      label="화면 이동"
      items={NAV_RAIL_ITEMS.map((item) => ({
        ...item,
        isActive:
          (item.key === 'records' && !isMy && !isFinding) ||
          (item.key === 'neighborhoods' && !isMy && isFinding) ||
          (item.key === 'my' && isMy),
        onSelect: () => {
          if (item.key === 'register') {
            // 기록 지도로 돌아와 지도 가운데에 `여기에 본 방 기록하기` 말풍선을 연다.
            if (isFinding || isMy) {
              onRecords();
              setWantsRegister(true);
            } else controller?.layers.startRegister?.();
          } else if (item.key === 'records') onRecords();
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
  const isFinding = isMy ? lastFinding : pathname.startsWith(NEIGHBORHOODS_PATH);
  if (!isMy && lastFinding !== isFinding) setLastFinding(isFinding);
  const [recordsUrl, setRecordsUrl] = useState(RECORDS_PATH);
  const [findingUrl, setFindingUrl] = useState(NEIGHBORHOODS_PATH);
  const currentUrl = pathname + search;
  if (!isMy && isFinding && findingUrl !== currentUrl) setFindingUrl(currentUrl);
  if (!isMy && !isFinding && recordsUrl !== currentUrl) setRecordsUrl(currentUrl);
  const isMobileDetail = !isDesktop && !isFinding && params.propertyId !== undefined;
  const closeMy = () => navigate(isFinding ? findingUrl : recordsUrl);
  const config = usePublicConfig();
  // 동네 찾기로 넘어갈 때 지난 검색(목적지, 조건, 결과)이 있으면 그 화면으로 그대로 돌아간다. 다시 조회하지 않는다.
  // 목적지를 한 번도 정하지 않았을 때만 출퇴근 장소 검색을 연다.
  const toFinding: MapModeSwitch = {
    target: 'neighborhoods',
    onSwitch: () =>
      navigate(readNeighborhoodSearch(neighborhoodSearchKey(config)) ? findingUrl : NEIGHBORHOOD_ADDRESS_SEARCH_PATH),
  };
  const toRecords: MapModeSwitch = { target: 'records', onSwitch: () => navigate(recordsUrl) };
  const panel = isMy ? { content: <MyMapPanel onClose={closeMy} />, close: closeMy } : null;
  return (
    <RecordsMapProvider>
      <SharedMapCanvasProvider
        preserveZoomOnModeChange
        infrastructure={{ open: !isFinding && (isDesktop || recordsView === 'map'), onClose: () => undefined }}
      >
        <div className={styles.page} data-desktop={isDesktop}>
          {isDesktop && (
            <UnifiedNavRail
              isMy={isMy}
              isFinding={isFinding}
              onRecords={toRecords.onSwitch}
              onFinding={toFinding.onSwitch}
              onMy={() => navigate(MY_PATH)}
              onTool={(path) => navigate(path)}
            />
          )}
          <div className={styles.content}>
            <div hidden={isFinding || isMobileDetail} className={styles.screen} data-mobile={!isDesktop || undefined}>
              <MapCanvasMode active={!isFinding && !isMobileDetail}>
                <MapPanelProvider value={isMy && !isFinding ? panel : null}>
                  <MapModeProvider value={toFinding}>
                    <DesignRecordsPage />
                  </MapModeProvider>
                </MapPanelProvider>
              </MapCanvasMode>
            </div>
            <div hidden={!isFinding} className={styles.screen} data-mobile={!isDesktop || undefined}>
              <MapCanvasMode active={isFinding}>
                <MapPanelProvider value={isMy && isFinding ? panel : null}>
                  <MapModeProvider value={toRecords}>
                    <NeighborhoodPreviewPage />
                  </MapModeProvider>
                </MapPanelProvider>
              </MapCanvasMode>
            </div>
            {isMobileDetail && (
              <div className={styles.detail}>
                <Outlet />
              </div>
            )}
          </div>
        </div>
      </SharedMapCanvasProvider>
    </RecordsMapProvider>
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
    --map-mode-bottom: 0px;
    --map-profile-space: 0px;
    &[data-desktop='true'] {
      display: grid;
      grid-template-columns: 76px minmax(0, 1fr);
      --unified-panel-top: 0px;
      --map-mode-bottom: 0px;
      --map-profile-space: 0px;
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
