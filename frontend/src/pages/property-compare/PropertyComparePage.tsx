import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';

import CompareDesktopPage from './desktop/CompareDesktopPage';
import CompareMobilePage from './mobile/CompareMobilePage';

/** 비교할 매물 선택(`/compare`). 데스크탑·휴대폰 화면을 여기서 한 번만 고른다. */
const PropertyComparePage = () => (useIsDesktop() ? <CompareDesktopPage /> : <CompareMobilePage />);

export default PropertyComparePage;
