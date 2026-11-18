import { css } from '@emotion/css';
import type { ReactNode } from 'react';

import type { MealTabs } from '../../hooks/useMealTabs';
import ConveniencePanel from '../ConveniencePanel';
import DeliveryPanel from '../DeliveryPanel';
import RestaurantPanel from '../RestaurantPanel';

type MealTabPanelsProps = {
  tabs: MealTabs;
  /** 데스크탑 식당 탭의 리스트 칸 맨 위에 둘 머리(제목과 탭). */
  restaurantListHeader?: ReactNode;
};

/**
 * 탭마다 패널을 하나씩 둔다. 한 번 연 패널은 숨겨 두기만 해서 필터와 스크롤을 지킨다.
 * 데스크탑에서는 각 패널이 넓은 화면 배치를 쓴다.
 */
const MealTabPanels = ({ tabs, restaurantListHeader }: MealTabPanelsProps) => {
  const { tab, layout } = tabs;
  const convenience = <ConveniencePanel isActive={tab === 'convenience'} layout={layout} onDetail={tabs.openDetail} />;
  const delivery = <DeliveryPanel isActive={tab === 'delivery'} layout={layout} onDetail={tabs.openDetail} />;
  // 데스크탑은 세 탭이 같은 구조를 쓴다. 지도를 든 식당 패널을 늘 그려 두고, 편의점과 배달은 그 왼쪽 목록 칸 안에서만 바뀐다.
  if (layout === 'desktop') {
    const others = (
      <>
        {(['convenience', 'delivery'] as const).map((value) => (
          <div
            key={value}
            role="tabpanel"
            id={`meal-panel-${value}`}
            aria-labelledby={`meal-tab-${value}`}
            hidden={tab !== value}
            className={styles.listPanel}
          >
            {tabs.isRendered(value) && (value === 'convenience' ? convenience : delivery)}
          </div>
        ))}
      </>
    );
    return (
      <div
        role={tab === 'restaurant' ? 'tabpanel' : undefined}
        id={tab === 'restaurant' ? 'meal-panel-restaurant' : undefined}
        aria-labelledby={tab === 'restaurant' ? 'meal-tab-restaurant' : undefined}
        className={styles.mapPanel}
      >
        <RestaurantPanel
          isActive={tab === 'restaurant'}
          layout={layout}
          listHeader={restaurantListHeader}
          listOverride={others}
        />
      </div>
    );
  }
  return (
    <>
      {(['restaurant', 'convenience', 'delivery'] as const).map((value) => (
        <div
          key={value}
          role="tabpanel"
          id={`meal-panel-${value}`}
          aria-labelledby={`meal-tab-${value}`}
          hidden={tab !== value}
          className={value === 'restaurant' ? styles.mapPanel : styles.scrollPanel}
        >
          {tabs.isRendered(value) &&
            (value === 'restaurant' ? (
              <RestaurantPanel isActive={tab === value} layout={layout} listHeader={restaurantListHeader} />
            ) : value === 'convenience' ? (
              convenience
            ) : (
              delivery
            ))}
        </div>
      ))}
    </>
  );
};

const styles = {
  scrollPanel: css`
    label: MealTabPanels-scrollPanel;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-bottom: env(safe-area-inset-bottom);
    &[hidden] {
      display: none;
    }
  `,
  listPanel: css`
    label: MealTabPanels-listPanel;
    &[hidden] {
      display: none;
    }
  `,
  mapPanel: css`
    label: MealTabPanels-mapPanel;
    flex: 1;
    min-height: 0;
    &[hidden] {
      display: none;
    }
  `,
};

export default MealTabPanels;
