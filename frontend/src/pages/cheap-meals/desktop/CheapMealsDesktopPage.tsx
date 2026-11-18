import { css } from '@emotion/css';

import { LogScreen } from '@/shared/lib/analytics/logging';
import PageHeading from '@/shared/ui/page-heading/PageHeading';

import useMealTabs from '../hooks/useMealTabs';
import { CHEAP_MEAL_EVENTS } from '../lib/cheapMealAnalytics';
import MealTabList from '../ui/meal-tab-list/MealTabList';
import MealTabPanels from '../ui/meal-tab-panels/MealTabPanels';
import MealDetails from '../ui/MealDetails';

/**
 * 데스크탑 화면. 왼쪽 네비 레일 옆에서 세 탭(식당, 편의점, 배달)이 같은 구조를 쓴다.
 * 왼쪽에 폭이 고정된 리스트 칸(제목, 가로 탭, 목록), 오른쪽에 공용 지도가 있다.
 * 탭을 바꿔도 칸 폭과 제목, 탭 위치와 지도 중심, 줌은 그대로이고 목록 내용만 바뀐다. 편의점과 배달은 위치 데이터가 없어 지도에 마커를 그리지 않는다.
 */
const CheapMealsDesktopPage = () => {
  const tabs = useMealTabs('desktop');
  // 제목과 탭은 세 탭 모두 지도 왼쪽 리스트 칸 맨 위에 둬서, 탭을 바꿔도 제자리에 있다.
  const header = (
    <div className={styles.top}>
      <PageHeading title="저렴한 한 끼" />
      <MealTabList tabs={tabs} />
    </div>
  );
  return (
    // 탭은 주소로 바뀌므로 key 없이 화면에 처음 들어올 때만 기록한다.
    <LogScreen event={CHEAP_MEAL_EVENTS.viewed}>
      <main className={styles.page}>
        <div className={styles.layout}>
          <div className={styles.body}>
            <MealTabPanels tabs={tabs} restaurantListHeader={header} />
          </div>
        </div>
        {tabs.detail && <MealDetails detail={tabs.detail} layout={tabs.layout} onClose={tabs.closeDetail} />}
      </main>
    </LogScreen>
  );
};

const styles = {
  page: css`
    label: CheapMealsDesktopPage-page;
    display: flex;
    flex-direction: column;
    height: 100dvh;
    background: var(--color-surface);
    color: var(--color-ink);
    overflow: hidden;
  `,

  layout: css`
    label: CheapMealsDesktopPage-layout;
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  `,

  /* 리스트 칸 맨 위(내 기록의 리스트 칸 머리와 같은 자리). */
  top: css`
    label: CheapMealsDesktopPage-top;
    display: grid;
    flex: none;
    gap: 0.5rem;
    padding: 1.25rem 1rem 0;
    border-bottom: 1px solid var(--color-border);
  `,

  body: css`
    label: CheapMealsDesktopPage-body;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  `,
};

export default CheapMealsDesktopPage;
