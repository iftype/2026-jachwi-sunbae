import { css } from '@emotion/css';

import { usePublicConfig } from '@/shared/config/PublicConfigContext';

import { formatAppVersionLabel } from '../lib/appVersionLabel';
import MyPageContent from '../ui/MyPageContent';

import * as shared from '../MyPage.styles';

/** 휴대폰·태블릿 마이. 뒤로 가기와 제목은 앱 상단 바에 표시한다. */
const MyMobilePage = () => {
  const config = usePublicConfig();

  return (
    <main className={shared.page}>
      <div className={styles.container}>
        <MyPageContent />
      </div>
      <footer className={`${shared.footer} ${styles.footer}`}>
        <span>{formatAppVersionLabel(config)}</span>
      </footer>
    </main>
  );
};

const styles = {
  container: css`
    label: MyMobilePage-container;
    width: min(100%, 26rem);
    margin-inline: auto;
    padding: 0.65rem 1rem 1rem;
  `,

  footer: css`
    label: MyMobilePage-footer;
    width: min(100%, 26rem);
    margin-right: auto;
    margin-left: auto;
    padding-right: 1rem;
    padding-left: 1rem;
    /* 바닥 문구는 카드 아래에 떠 있지 않고 화면 맨 아래에 둔다. */
    margin-top: auto;
    padding-top: 1.5rem;
    padding-bottom: 1.25rem;
  `,
};

export default MyMobilePage;
