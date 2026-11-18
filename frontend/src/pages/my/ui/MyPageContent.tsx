import { css } from '@emotion/css';
import { Link } from 'react-router-dom';

import { useMember } from '@/features/auth/api/useCurrentMember';
import WeatherSummaryCard from '@/features/weather/ui/weather-summary-card/WeatherSummaryCard';
import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';
import { COMPARE_PATH } from '@/shared/lib/navigation/appPaths';
import Icon from '@/shared/ui/icon/Icon';

import AccountLinkCard from './account-link-card/AccountLinkCard';
import AccountWithdrawCard from './account-withdraw-card/AccountWithdrawCard';
import MyQuickLinks from './MyQuickLinks';
import PrivacyLinkCard from './privacy-link-card/PrivacyLinkCard';

import * as rowStyles from './my-row-card/MyRowCard.styles';

const MyPageContent = () => {
  const member = useMember();
  const isDesktop = useIsDesktop();

  return (
    <div className={styles.content} data-mobile={!isDesktop || undefined}>
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
        <Link to={COMPARE_PATH} className={rowStyles.notice}>
          <span>
            <strong>기록 PDF 받기</strong>
          </span>
          <Icon name="chevron-right" size={16} />
        </Link>
        <PrivacyLinkCard />
        <AccountWithdrawCard />
      </div>
    </div>
  );
};

const styles = {
  content: css`
    display: grid;
    gap: var(--space-md);
    color: var(--color-ink);
    & > section {
      border: 1px solid var(--color-border);
      border-radius: var(--radius-card);
    }

    &[data-mobile='true'] {
      flex: 1;
      min-height: 0;
      align-content: start;
      gap: 0.5rem;
      background: var(--color-surface);
      & > section {
        border: 0;
        border-radius: 0;
        background: var(--color-surface);
        padding: 0.65rem 1rem;
      }
      & > section + section,
      & > nav,
      & > div {
        border-top: 1px solid var(--color-border);
      }
      & > nav {
        padding: 0.65rem 1rem;
        background: var(--color-surface);
      }
      & > nav > a {
        border: 0;
        border-radius: var(--radius-card);
        background: var(--color-surface-muted);
        padding: 0.35rem;
      }
      & > div {
        border: 0;
        border-top: 1px solid var(--color-border);
        border-radius: 0;
      }
    }

    /* 카드 안 선 아이콘(계정, 위치, 알림 등)은 조금 두껍게 그린다. */
    & svg {
      stroke-width: var(--my-icon-stroke);
    }
  `,
  settings: css`
    & svg {
      color: var(--color-primary);
    }
    & [role='switch'][aria-checked='true'] {
      background: var(--color-primary);
    }
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
    border: 1px solid var(--color-border);

    & > a:first-child {
      color: var(--color-primary);
    }
    & > :is(a, button) + :is(a, button) {
      border-top: 1px solid var(--color-border);
    }
  `,
};

export default MyPageContent;
