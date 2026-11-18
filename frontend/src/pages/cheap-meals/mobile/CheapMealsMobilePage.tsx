import { css } from '@emotion/css';

import { LogScreen } from '@/shared/lib/analytics/logging';
import { HOME_PATH } from '@/shared/lib/navigation/appPaths';
import TopNavigation from '@/shared/ui/top-navigation/TopNavigation';

import useMealTabs from '../hooks/useMealTabs';
import { CHEAP_MEAL_EVENTS } from '../lib/cheapMealAnalytics';
import MealTabList from '../ui/meal-tab-list/MealTabList';
import MealTabPanels from '../ui/meal-tab-panels/MealTabPanels';
import MealDetails from '../ui/MealDetails';

/** 휴대폰과 태블릿 화면. 한 화면 높이 안에서 헤더와 탭을 고정하고 패널만 스크롤한다. */
const CheapMealsMobilePage = () => {
  const tabs = useMealTabs('mobile');
  return (
    // 탭은 주소로 바뀌므로 key 없이 화면에 처음 들어올 때만 기록한다.
    <LogScreen event={CHEAP_MEAL_EVENTS.viewed}>
      <main className={styles.page}>
        <TopNavigation
          title="저렴한 한 끼 찾기"
          backTo={HOME_PATH}
          backLabel="홈으로 돌아가기"
          className={styles.header}
        />
        <MealTabList tabs={tabs} className={styles.tabs} />
        <MealTabPanels tabs={tabs} />
        {tabs.detail && <MealDetails detail={tabs.detail} layout={tabs.layout} onClose={tabs.closeDetail} />}
      </main>
    </LogScreen>
  );
};

const styles = {
  page: css`
    label: CheapMealsMobilePage-page;
    height: 100dvh;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 60rem;
    margin: auto;
    background: var(--color-surface);
    color: var(--color-ink);
    overflow: hidden;
    padding-top: env(safe-area-inset-top);
    /* 하단 탭이 보이는 동안 탭 높이만큼 비운다. */
    padding-bottom: var(--mobile-tab-space, 0px);
    box-sizing: border-box;
  `,
  header: css`
    label: CheapMealsMobilePage-header;
    flex-shrink: 0;
    margin-bottom: 0;
    padding: 0 1rem;
  `,
  tabs: css`
    label: CheapMealsMobilePage-tabs;
    padding: 0 1rem;
  `,
};

export default CheapMealsMobilePage;
