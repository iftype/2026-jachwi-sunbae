import { css } from '@emotion/css';
import { useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';

import DesignRecordsPage from '@/pages/design-records/DesignRecordsPage';
import useRecordsView from '@/pages/design-records/hooks/useRecordsView';
import { RecordsMapProvider } from '@/pages/design-records/RecordsMapProvider';
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

import MyMapPanel from './ui/MyMapPanel';

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
      --unified-panel-top: 1rem;
      --map-mode-bottom: 0px;
      --map-profile-space: 0px;
    }
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
