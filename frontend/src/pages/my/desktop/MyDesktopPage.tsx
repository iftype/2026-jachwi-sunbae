import { css } from '@emotion/css';

import { usePublicConfig } from '@/shared/config/PublicConfigContext';
import TopNavigation from '@/shared/ui/top-navigation/TopNavigation';

import { formatAppVersionLabel } from '../lib/appVersionLabel';
import MyPageContent from '../ui/MyPageContent';

import * as shared from '../MyPage.styles';

/** 데스크탑 마이. 공용 헤더로 이동하므로 뒤로 가기 없이 제목만 두고, 좁은 한 열에 카드를 위에서 아래로 쌓는다. */
const MyDesktopPage = () => {
  const config = usePublicConfig();

  return (
    <main className={shared.page}>
      <div className={styles.layout}>
        <div className={styles.heading}>
          <TopNavigation title="마이" />
        </div>
        <MyPageContent />
      </div>
      <footer className={`${shared.footer} ${styles.footer}`}>
        <span>{formatAppVersionLabel(config)}</span>
      </footer>
    </main>
  );
};

const styles = {
  /*
   * 데스크탑 마이: 좁은 한 열(30rem)에 제목, 날씨 카드, 링크 카드를 위에서 아래로 쌓아 화면 가운데에 둔다.
   * 이 화면의 기준 글자 크기(rem)는 데스크탑 셸이 125%로 올려 두므로, 카드 안 글자와 여백은 휴대폰과 같은 값으로 둔다.
   */
  layout: css`
    label: MyDesktopPage-layout;
    width: min(100%, 30rem);
    margin-right: auto;
    margin-left: auto;
    padding-right: 1rem;
    padding-left: 1rem;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
    gap: 0.6rem;
    padding-top: 1rem;
    padding-bottom: 2rem;
  `,

  footer: css`
    label: MyDesktopPage-footer;
    width: min(100%, 30rem);
    margin-right: auto;
    margin-left: auto;
    padding-right: 1rem;
    padding-left: 1rem;
    /* 바닥 문구는 카드 아래에 떠 있지 않고 화면 맨 아래에 둔다. */
    margin-top: auto;
    padding-top: 1.5rem;
    padding-bottom: 1.25rem;
  `,

  heading: css`
    label: MyDesktopPage-heading;
    grid-column: 1 / -1;
    margin-bottom: 0.5rem;
  `,
};

export default MyDesktopPage;
