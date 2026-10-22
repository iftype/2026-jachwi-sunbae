import HomeFeatures from '../ui/HomeFeatures';
import HomeFooter from '../ui/HomeFooter';
import HomeHeader from '../ui/HomeHeader';
import QuickMenu from '../ui/QuickMenu';
import RecentRooms from '../ui/RecentRooms';

import shared from '../HomePage.module.css';
import styles from './HomeMobilePage.module.css';

/** 휴대폰·태블릿 홈. 홈 전용 헤더 아래에 안내·기능 카드·빠른 메뉴·최근 기록을 한 열로 쌓는다. */
const HomeMobilePage = () => (
  <main className={`${shared.page} ${styles.root}`}>
    <HomeHeader className={styles.topBar} />
    <div className={styles.container}>
      <p className={`${shared.tip} ${styles.tip}`}>계약 전, 놓친 문제는 없는지 확인해보세요.</p>
      <HomeFeatures />
    </div>
    <div className={styles.side}>
      <QuickMenu />
      <RecentRooms />
    </div>
    <HomeFooter className={styles.footer} />
  </main>
);

export default HomeMobilePage;
