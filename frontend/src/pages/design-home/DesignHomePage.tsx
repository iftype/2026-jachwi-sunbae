import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';

import HomeDesktopPage from './desktop/HomeDesktopPage';
import HomeMobilePage from './mobile/HomeMobilePage';

/** 로그인 뒤 홈(`/`). 데스크탑·휴대폰 화면을 여기서 한 번만 고르고, 카드·메뉴 조각은 두 화면이 함께 쓴다. */
const DesignHomePage = () => (useIsDesktop() ? <HomeDesktopPage /> : <HomeMobilePage />);

export default DesignHomePage;
