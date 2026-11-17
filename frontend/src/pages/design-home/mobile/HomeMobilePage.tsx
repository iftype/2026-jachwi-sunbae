import { css } from '@emotion/css';

import HomeFooter from '../ui/HomeFooter';
import HomeHeader from '../ui/HomeHeader';
import RecentRooms from '../ui/RecentRooms';

import * as shared from '../HomePage.styles';

const HomeMobilePage = () => (
  <main className={shared.page}>
    <div className={styles.container}>
      <HomeHeader className={styles.header} />
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

    & > footer {
      margin-top: auto;
      padding-inline: 1rem;
      /* 떠 있는 매물 추가 버튼이 푸터 글자를 가리지 않게 아래를 비운다. */
      padding-bottom: calc(7.5rem + env(safe-area-inset-bottom));
    }
  `,
  /* 바탕은 회색이지만 헤더는 흰색으로 둔다. */
  header: css`
    padding: max(0.5rem, env(safe-area-inset-top)) 1rem 0.5rem;
    background: var(--color-surface);
  `,
  /* 휴대폰은 카드가 가로 폭을 다 쓴다. */
  content: css`
    align-content: start;
    display: grid;
    gap: 0.5rem;
    padding-block: 0.5rem 1rem;

    & > section > section {
      border-radius: 0;
    }

    /* 동네 찾기는 가로를 다 쓰지 않고 좌우 여백을 둔 카드로 둔다. */
    /* 휴대폰은 동네 찾기를 기록 목록보다 위에 둔다. */
    & > section > aside {
      order: -1;
      padding-inline: 1rem;
    }
  `,
};

export default HomeMobilePage;
