import { css } from '@emotion/css';
import { useEffect, useMemo, useRef } from 'react';
import { Navigate, useLocation, useMatch, useNavigate } from 'react-router-dom';

import { useRecordsMapController } from '@/pages/design-records/RecordsMapProvider';
import { readSearchedAddress } from '@/features/map/lib/searchedAddressState';
import StreetMemoPanel from '@/features/street-memo/ui/street-memo-panel/StreetMemoPanel';
import StreetMemoSheet from '@/features/street-memo/ui/street-memo-sheet/StreetMemoSheet';
import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';
import { ROUTE_PATTERNS } from '@/shared/lib/navigation/appPaths';

import NeighborhoodPreviewDesktopPage from './desktop/NeighborhoodPreviewDesktopPage';
import useNeighborhoodPreview from './hooks/useNeighborhoodPreview';
import NeighborhoodPreviewMobilePage from './mobile/NeighborhoodPreviewMobilePage';

/**
 * 동네 찾기(`/neighborhoods`, 공개 `/explore`). 데스크탑·휴대폰은 구도가 달라 화면을 나누고, 검색 상태는 여기서 한 번만 만들어 넘긴다.
 * 그래서 창 폭이 데스크탑 기준을 넘나들어도 고른 위치·조건·결과가 그대로 남는다.
 */
const NeighborhoodPreviewPage = () => {
  const preview = useNeighborhoodPreview();
  const isDesktop = useIsDesktop();
  const registration = useRecordsMapController();
  const location = useLocation();
  const navigate = useNavigate();
  const address = useMemo(
    () => (location.pathname.startsWith(preview.mapPath) ? readSearchedAddress(location.state) : null),
    [location.pathname, location.state, preview.mapPath],
  );
  const navigationState: unknown = location.state;
  const openRecommendationFilters =
    navigationState !== null &&
    typeof navigationState === 'object' &&
    'openRecommendationFilters' in navigationState &&
    navigationState.openRecommendationFilters === true;
  const selectAddress = preview.selectAddress;
  const selectRef = useRef(selectAddress);
  selectRef.current = selectAddress;
  const searchToRef = useRef(preview.searchTo);
  searchToRef.current = preview.searchTo;
  // 출퇴근 장소를 새로 고르면 이전 결과를 버리고 지금 조건으로 바로 다시 찾는다. 기록 지도의 `동네 추천받기`처럼
  // 조건 시트를 먼저 여는 진입만 조건을 고른 뒤 찾는다.
  useEffect(() => {
    if (!address) return;
    // `동네 추천받기`로 넘어온 주소만 출퇴근 장소가 된다. 지도 검색(위쪽 검색창)으로 온 주소는 지도를 옮기고 검색 핀만 찍는다.
    if (openRecommendationFilters) selectRef.current(address, { analyze: false });
    else searchToRef.current(address);
    navigate(location.pathname + location.search, { replace: true, state: null });
  }, [address, navigate, location.pathname, location.search, openRecommendationFilters]);
  const selectionState: unknown = location.state;
  const selectOnMap =
    selectionState !== null &&
    typeof selectionState === 'object' &&
    'selectDestinationOnMap' in selectionState &&
    selectionState.selectDestinationOnMap === true;
  const openSelection = useRef(preview.openMapSelection);
  openSelection.current = preview.openMapSelection;
  useEffect(() => {
    if (!selectOnMap || !location.pathname.startsWith(preview.mapPath)) return;
    openSelection.current();
    navigate(location.pathname + location.search, { replace: true, state: null });
  }, [selectOnMap, location.pathname, location.search, preview.mapPath, navigate]);
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') preview.cancelMapSelection();
    };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, [preview]);
  const isRoutePage = useMatch(`${preview.mapPath}/${ROUTE_PATTERNS.area}/*`);
  if (isRoutePage && !preview.selected && !preview.isAnalyzing && !preview.error) {
    return <Navigate to={preview.mapPath} replace />;
  }
  return (
    <>
      {isDesktop ? (
        <NeighborhoodPreviewDesktopPage preview={preview} />
      ) : (
        <NeighborhoodPreviewMobilePage preview={preview} />
      )}
      {!preview.isPublicExplore &&
        registration &&
        (isDesktop ? (
          <StreetMemoPanel layer={registration.layers.memo} className={memoPanel} />
        ) : (
          <StreetMemoSheet layer={registration.layers.memo} />
        ))}
    </>
  );
};
export default NeighborhoodPreviewPage;

const memoPanel = css`
  label: NeighborhoodPreviewPage-memoPanel;
  position: absolute;
  z-index: 90;
  top: 5rem;
  right: 5rem;
  width: min(24rem, calc(100% - 2rem));
  max-height: calc(100% - 6rem);
  overflow-y: auto;
`;
