import { useOutletContext } from 'react-router-dom';

import type { Member } from '@/features/auth/model/Member';
import WeatherSummaryCard from '@/features/weather/ui/weather-summary-card/WeatherSummaryCard';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';

import AccountDeletionCard from '../ui/account-deletion-card/AccountDeletionCard';
import PrivacyLinkCard from '../ui/privacy-link-card/PrivacyLinkCard';

import shared from '../MyPage.module.css';
import styles from './MyMobilePage.module.css';

/** 휴대폰·태블릿 마이. 뒤로 가기·제목은 앱 상단 바가 그리고, 홈과 같은 본문(최대 45rem)에 카드를 늘이지 않고 쌓는다. */
const MyMobilePage = () => {
  const config = usePublicConfig();
  const member = useOutletContext<Member>();

  return (
    <main className={shared.page}>
      <div className={styles.container}>
        <WeatherSummaryCard />
        <div className={styles.links}>
          <PrivacyLinkCard />
          <AccountDeletionCard memberId={member.memberId} />
        </div>
      </div>
      <footer className={`${shared.footer} ${styles.footer}`}>
        <span>자취선배 MVP2 · {config.mapProviderMode === 'demo' ? 'DEMO MAP' : 'LIVE MAP'}</span>
      </footer>
    </main>
  );
};

export default MyMobilePage;
