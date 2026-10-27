import { useOutletContext } from 'react-router-dom';

import type { Member } from '@/features/auth/model/Member';
import WeatherSummaryCard from '@/features/weather/ui/weather-summary-card/WeatherSummaryCard';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';
import TopNavigation from '@/shared/ui/top-navigation/TopNavigation';

import AccountDeletionCard from '../ui/account-deletion-card/AccountDeletionCard';
import PrivacyLinkCard from '../ui/privacy-link-card/PrivacyLinkCard';

import shared from '../MyPage.module.css';
import styles from './MyDesktopPage.module.css';

/** 데스크탑 마이. 공용 헤더로 이동하므로 뒤로 가기 없이 제목만 두고, 홈과 같은 64rem 본문에 카드를 늘이지 않고 나란히 둔다. */
const MyDesktopPage = () => {
  const config = usePublicConfig();
  const member = useOutletContext<Member>();

  return (
    <main className={shared.page}>
      <div className={styles.layout}>
        <div className={styles.heading}>
          <TopNavigation title="마이" />
        </div>
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

export default MyDesktopPage;
