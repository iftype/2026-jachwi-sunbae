import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';

import MyDesktopPage from './desktop/MyDesktopPage';
import MyMobilePage from './mobile/MyMobilePage';

/** 마이(`/me`). 데스크탑·휴대폰 화면은 구조가 달라 여기서 한 번만 고르고, 카드·메뉴 조각은 함께 쓴다. */
const MyPage = () => (useIsDesktop() ? <MyDesktopPage /> : <MyMobilePage />);

export default MyPage;
