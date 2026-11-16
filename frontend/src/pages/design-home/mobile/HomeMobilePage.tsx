import { css } from '@emotion/css';

import HomeFooter from '../ui/HomeFooter';
import HomeHeader from '../ui/HomeHeader';
import RecentRooms from '../ui/RecentRooms';

import * as shared from '../HomePage.styles';

const HomeMobilePage = () => (
  <main className={shared.page}>
    <div className={styles.container}>
      <HomeHeader />
      <div className={styles.content}>
        <RecentRooms />
      </div>
      <HomeFooter />
    </div>
  </main>
);

const styles = {
  container: css`
    display: flex;
    flex-direction: column;
    min-height: 100%;
    width: min(100%, 45rem);
    margin-inline: auto;
    padding: max(0.5rem, env(safe-area-inset-top)) 1rem 0;

    & > footer {
      margin-top: auto;
    }
  `,
  content: css`
    padding-block: 0.65rem 1rem;
  `,
};

export default HomeMobilePage;
