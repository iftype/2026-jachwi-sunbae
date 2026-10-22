import DesktopHeader from '@/shared/ui/desktop-header/DesktopHeader';

import HomeFeatures from '../ui/HomeFeatures';
import HomeFooter from '../ui/HomeFooter';
import QuickMenu from '../ui/QuickMenu';
import RecentRooms from '../ui/RecentRooms';

import shared from '../HomePage.module.css';
import styles from './HomeDesktopPage.module.css';

/** 데스크탑 홈. 다른 화면과 같은 공용 헤더를 쓰고, 기능 카드 옆 오른쪽 열에 빠른 메뉴·최근 기록을 둔다. */
const HomeDesktopPage = () => (
  <main className={`${shared.page} ${styles.root}`}>
    <DesktopHeader />
    <div className={styles.layout}>
      <p className={`${shared.tip} ${styles.tip}`}>계약 전, 놓친 문제는 없는지 확인해보세요.</p>
      <HomeFeatures className={styles.features} />
      <div className={styles.side}>
        <QuickMenu />
        {/* 최근 기록한 방은 상세로 넘어가지 않고 본 방 기록 화면에서 고른 상태로 연다. */}
        <RecentRooms inSideColumn />
      </div>
    </div>
    <HomeFooter className={styles.footer} alignStart />
  </main>
);

export default HomeDesktopPage;
