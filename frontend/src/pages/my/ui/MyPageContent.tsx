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
      {/* 알림 설정은 자주 바꾸므로 계정 바로 아래에 둔다. */}
      <section className={styles.settings} aria-labelledby="my-settings-title">
        {/* 묶음 이름은 화면에 보이지 않게 두고 읽기 도구에만 알린다. */}
        <h2 id="my-settings-title" className="sr-only">
          서비스 설정
        </h2>
        <WeatherSummaryCard />
      </section>
      <MyQuickLinks />
      <div className={styles.settingsRows}>
        <PrivacyLinkCard />
        <AccountWithdrawCard />
      </div>
    </div>
  );
};

const styles = {
  content: css`
    display: grid;
    gap: 0.75rem;

    /* 카드 안 선 아이콘(계정, 위치, 알림 등)은 조금 두껍게 그린다. */
    & svg {
      stroke-width: var(--my-icon-stroke);
    }
  `,
  settings: css`
    display: grid;
    gap: 0.55rem;

    /* 묶음 이름은 홈의 목록 제목처럼 진한 굵은 글자로 둔다. */
    & > h2 {
      margin: 0.75rem 0 0;
      color: var(--color-ink);
      font-size: var(--my-text-size);
      font-weight: 800;
    }
  `,
  settingsRows: css`
    overflow: hidden;
    border-radius: var(--my-card-radius);
    background: var(--my-card-surface);

    & > :is(a, button) + :is(a, button) {
      border-top: 1px solid var(--color-border);
    }
  `,
};

export default MyPageContent;
