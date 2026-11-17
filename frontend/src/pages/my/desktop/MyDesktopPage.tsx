import { css } from '@emotion/css';

import HomeFooter from '@/pages/design-home/ui/HomeFooter';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';

import { formatAppVersionLabel } from '../lib/appVersionLabel';
import MyPageContent from '../ui/MyPageContent';

import * as shared from '../MyPage.styles';

/** 데스크탑 마이. 공용 헤더로 이동하므로 뒤로 가기 없이 제목만 두고, 좁은 한 열에 카드를 위에서 아래로 쌓는다. */
const MyDesktopPage = () => {
  const config = usePublicConfig();

  return (
    <main className={shared.page}>
      <div className={styles.layout}>
        {/* 화면 제목은 보이지 않게 두고 읽기 도구에만 알린다. */}
        <h1 className="sr-only">마이</h1>
        <MyPageContent />
      </div>
      {/* 홈과 같은 서비스 안내 푸터를 두고, 그 아래에 앱 버전을 작게 적는다. */}
      <HomeFooter className={styles.siteFooter} alignStart />
      <footer className={`${shared.footer} ${styles.footer}`}>
        <span>{formatAppVersionLabel(config)}</span>
      </footer>
    </main>
  );
};

const styles = {
  /* 서비스 안내 푸터는 카드 아래에 떠 있지 않고 화면 맨 아래에 둔다. */
  /* 본문 열은 80%로 줄여 그리므로(26rem → 약 21rem), 푸터도 그 폭에 맞춘다. */
  siteFooter: css`
    width: min(100%, 21rem);
    margin: auto auto 0;
    padding-top: 2rem;
    padding-inline: 1rem;
  `,
  /*
   * 데스크탑 마이: 도구 타일 네 개(5.5rem씩)가 한 줄에 꼭 맞는 한 열(26rem)에 계정, 날씨, 도구 카드를 위에서 아래로 쌓아 화면 가운데에 둔다.
   * 이 화면의 기준 글자 크기(rem)는 데스크탑 셸이 125%로 올려 두므로, 카드 안 글자와 여백은 휴대폰과 같은 값으로 둔다.
   */
  layout: css`
    label: MyDesktopPage-layout;
    /*
     * 데스크탑 셸이 기준 글자(rem)를 125%로 키워 카드와 로그인 버튼까지 커 보인다.
     * 마이는 휴대폰과 같은 크기로 보이게 이 열 전체를 그 비율만큼 줄인다.
     */
    zoom: 0.8;
    width: min(100%, 26rem);
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
    width: min(100%, 21rem);
    margin-right: auto;
    margin-left: auto;
    padding-right: 1rem;
    padding-left: 1rem;
    padding-top: 0.5rem;
    padding-bottom: 1.25rem;
  `,
};

export default MyDesktopPage;
