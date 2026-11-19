import { css } from '@emotion/css';

import type { MealTabs } from '../../hooks/useMealTabs';
import { MEAL_TABS, type MealTab } from '../../model/MealNavigation';

type MealTabListProps = {
  tabs: MealTabs;
  className?: string;
};

/** 식당, 편의점, 배달 가로 탭. 좌우 방향키와 Home, End로 탭을 옮긴다. */
const MealTabList = ({ tabs, className }: MealTabListProps) => (
  <div
    role="tablist"
    aria-label="한 끼 카테고리"
    aria-orientation="horizontal"
    className={`${styles.tabs} ${className ?? ''}`.trim()}
  >
    {(Object.keys(MEAL_TABS) as MealTab[]).map((value, index, all) => (
      <button
        key={value}
        type="button"
        role="tab"
        id={`meal-tab-${value}`}
        aria-controls={`meal-panel-${value}`}
        aria-selected={tabs.tab === value}
        tabIndex={tabs.tab === value ? 0 : -1}
        onClick={() => tabs.selectTab(value, 'top_tab')}
        onKeyDown={(event) => {
          const next =
            event.key === 'ArrowRight'
              ? all[(index + 1) % all.length]
              : event.key === 'ArrowLeft'
                ? all[(index + all.length - 1) % all.length]
                : event.key === 'Home'
                  ? all[0]
                  : event.key === 'End'
                    ? all[all.length - 1]
                    : null;
          if (next) {
            event.preventDefault();
            tabs.selectTab(next, 'top_tab');
            document.getElementById(`meal-tab-${next}`)?.focus();
          }
        }}
      >
        {MEAL_TABS[value]}
      </button>
    ))}
  </div>
);

const styles = {
  tabs: css`
    label: MealTabList-tabs;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
    & button {
      min-height: 48px;
      border: 0;
      border-bottom: 3px solid transparent;
      background: none;
      font: inherit;
      font-size: 0.9rem;
      color: var(--color-ink-soft);
      cursor: pointer;
    }
    & button[aria-selected='true'] {
      border-color: var(--color-brand-yellow);
      color: var(--color-ink);
      font-weight: 800;
    }
  `,
};

export default MealTabList;
