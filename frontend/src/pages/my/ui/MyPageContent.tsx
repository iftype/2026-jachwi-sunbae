import { css } from '@emotion/css';

import { useMember } from '@/features/auth/api/useCurrentMember';
import WeatherSummaryCard from '@/features/weather/ui/weather-summary-card/WeatherSummaryCard';
import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';

import AccountLinkCard from './account-link-card/AccountLinkCard';
import AccountWithdrawCard from './account-withdraw-card/AccountWithdrawCard';
import MyShortcutLinks from './my-shortcut-links/MyShortcutLinks';
import PrivacyLinkCard from './privacy-link-card/PrivacyLinkCard';

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
      {/* 지도 밖 도구 화면(체크리스트, 방 비교, 저렴한 한 끼, 사용방법)으로 가는 곳은 마이페이지 한 곳이다. */}
      <MyShortcutLinks />
      <div className={styles.settingsRows}>
        <PrivacyLinkCard />
        <AccountWithdrawCard />
      </div>
    </div>
  );
};

const styles = {
  /* 가로 여백은 바깥 화면(--my-gutter)이 한 번만 주므로 여기서는 세로 간격만 둔다. 섹션 사이는 16px. */
  content: css`
    label: MyPageContent-content;
    display: grid;
    align-content: start;
    gap: 1rem;
    color: var(--color-ink);

    &[data-mobile='true'] {
      flex: 1;
      min-height: 0;
    }

    /* 로그인 영역과 알림 영역은 카드 안쪽 여백 없이 여백선에 바로 붙는다. */
    & > section {
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
    }

    /* 카드 안 선 아이콘(계정, 위치, 알림 등)은 조금 두껍게 그린다. */
    & svg {
      stroke-width: var(--my-icon-stroke);
    }
  `,
  settings: css`
    label: MyPageContent-settings;
    & svg {
      color: var(--color-primary);
    }
    & [role='switch'][aria-checked='true'] {
      background: var(--color-primary);
    }
    display: grid;
    gap: 0.75rem;

    & > section {
      border: 0;
      background: transparent;
    }
  `,
  settingsRows: css`
    label: MyPageContent-settingsRows;
    display: grid;
    gap: 0.35rem;
  `,
};

export default MyPageContent;
