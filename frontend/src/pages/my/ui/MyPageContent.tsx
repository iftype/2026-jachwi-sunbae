import { css } from '@emotion/css';

import { useMember } from '@/features/auth/api/useCurrentMember';
import WeatherSummaryCard from '@/features/weather/ui/weather-summary-card/WeatherSummaryCard';

import AccountLinkCard from './account-link-card/AccountLinkCard';
import AccountWithdrawCard from './account-withdraw-card/AccountWithdrawCard';
import MyQuickLinks from './MyQuickLinks';
import PrivacyLinkCard from './privacy-link-card/PrivacyLinkCard';

const MyPageContent = () => {
  const member = useMember();

  return (
    <div className={styles.content}>
      <AccountLinkCard memberId={member.memberId} />
      <MyQuickLinks />
      <section className={styles.settings} aria-labelledby="my-settings-title">
        <h2 id="my-settings-title">서비스 설정</h2>
        <WeatherSummaryCard />
        <div className={styles.settingsRows}>
          <PrivacyLinkCard />
          <AccountWithdrawCard />
        </div>
      </section>
    </div>
  );
};

const styles = {
  content: css`
    display: grid;
    gap: 0.65rem;
  `,
  settings: css`
    display: grid;
    gap: 0.55rem;

    & > h2 {
      margin: 0.2rem 0 0;
      color: var(--color-ink);
      font-size: var(--my-text-size);
    }
  `,
  settingsRows: css`
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);

    & > :is(a, button) + :is(a, button) {
      border-top: 1px solid var(--color-border);
    }
  `,
};

export default MyPageContent;
