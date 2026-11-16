import { css } from '@emotion/css';

import HeaderWeather from '@/features/weather/ui/header-weather/HeaderWeather';
import DesktopHeader from '@/shared/ui/desktop-header/DesktopHeader';

import HomeFooter from '../ui/HomeFooter';
import RecentRooms from '../ui/RecentRooms';

import * as shared from '../HomePage.styles';

const HomeDesktopPage = () => (
  <main className={shared.page}>
    <DesktopHeader homeNavigation center={<HeaderWeather />} />
    <div className={styles.layout}>
      <RecentRooms isDesktop />
    </div>
    <HomeFooter className={styles.footer} alignStart />
  </main>
);

const styles = {
  layout: css`
    width: min(100%, 75rem);
    margin: 0 auto;
    padding: clamp(1.5rem, 4vw, 3.25rem) 2rem 0;
  `,
  footer: css`
    width: min(100%, 75rem);
    margin-inline: auto;
    padding-inline: 2rem;
  `,
};

export default HomeDesktopPage;
