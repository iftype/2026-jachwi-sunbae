import { css } from '@emotion/css';

import HeaderWeather from '@/features/weather/ui/header-weather/HeaderWeather';
import DesktopHeader from '@/shared/ui/desktop-header/DesktopHeader';

import HomeFooter from '../ui/HomeFooter';
import RecentRooms from '../ui/RecentRooms';

import * as shared from '../HomePage.styles';

const HomeDesktopPage = () => (
  <main className={`${shared.page} ${styles.page}`}>
    <DesktopHeader className={styles.header} center={<HeaderWeather />} />
    <div className={styles.layout}>
      <RecentRooms isDesktop />
    </div>
    <HomeFooter className={styles.footer} alignStart />
  </main>
);

const styles = {
  /* 목록이 짧아도 푸터가 화면 맨 아래에 붙도록 본문 칸이 남는 높이를 채운다. */
  page: css`
    display: flex;
    flex-direction: column;
  `,
  /* 바탕이 회색이라 헤더만 흰색으로 둔다. */
  header: css`
    background: var(--color-surface);
  `,
  layout: css`
    flex: 1 0 auto;
    /* 목록 줄이 너무 길어 보이지 않게 가운데 폭을 좁힌다. */
    width: min(100%, 66rem);
    margin: 0 auto;
    padding: clamp(1rem, 2.5vw, 2rem) 2rem 0;
  `,
  footer: css`
    /* 목록이 짧아도 푸터가 바로 붙지 않게 여유를 두고 내린다. */
    margin-top: clamp(4rem, 12vh, 8rem);
    /* 떠 있는 방 기록하기 버튼(바닥에서 6rem)이 맨 아래에서 푸터 글자를 가리지 않게 아래를 비운다. */
    padding-bottom: 10rem;
    width: min(100%, 75rem);
    margin-inline: auto;
    padding-inline: 2rem;
  `,
};

export default HomeDesktopPage;
