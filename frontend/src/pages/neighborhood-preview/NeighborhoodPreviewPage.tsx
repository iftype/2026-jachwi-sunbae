import { Navigate, useMatch } from 'react-router-dom';

import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';

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
  const isRoutePage = useMatch(`${preview.mapPath}/areas/:adminDongCode/*`);
  if (isRoutePage && !preview.selected && !preview.isAnalyzing && !preview.error) {
    return <Navigate to={preview.mapPath} replace />;
  }
  return isDesktop ? (
    <NeighborhoodPreviewDesktopPage preview={preview} />
  ) : (
    <NeighborhoodPreviewMobilePage preview={preview} />
  );
};
export default NeighborhoodPreviewPage;
