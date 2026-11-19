import { css } from '@emotion/css';

import Icon, { type IconName } from '../icon/Icon';
import { MOBILE_TAB_SPACE } from './bottomTabConfig';

export type BottomTab = {
  key: string;
  label: string;
  icon: IconName;
  isActive: boolean;
  onSelect: () => void;
};

type Props = { tabs: readonly BottomTab[]; hidden: boolean };

/** 휴대폰 화면 아래에 붙는 탭 바. 아래 안전 영역을 포함하며, 숨길 때는 아래로 내린다. */
const BottomTabBar = ({ tabs, hidden }: Props) => (
  <nav className={styles.bar} aria-label="하단 탭" data-hidden={hidden || undefined} aria-hidden={hidden || undefined}>
    {tabs.map((tab) => (
      <button
        key={tab.key}
        type="button"
        className={styles.tab}
        aria-current={tab.isActive ? 'page' : undefined}
        tabIndex={hidden ? -1 : undefined}
        onClick={tab.onSelect}
      >
        <Icon name={tab.icon} size={26} />
        <span>{tab.label}</span>
      </button>
    ))}
  </nav>
);

const styles = {
  bar: css`
    label: BottomTabBar-bar;
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 60;
    display: flex;
    box-sizing: border-box;
    height: ${MOBILE_TAB_SPACE};
    padding-bottom: env(safe-area-inset-bottom);
    border-top: 1px solid var(--color-border-strong);
    background: var(--color-navigation-surface);
    transition: transform 160ms ease-out;

    &[data-hidden='true'] {
      visibility: hidden;
      transform: translateY(100%);
      transition:
        transform 160ms ease-out,
        visibility 0s 160ms;
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  `,
  tab: css`
    label: BottomTabBar-tab;
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    min-width: 0;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-muted);
    font: inherit;
    font-size: clamp(11px, 3.2vw, 14px);
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1.2;
    white-space: nowrap;
    cursor: pointer;

    &[aria-current='page'] {
      color: var(--color-brand-blue-ink);
    }
    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: -2px;
    }
  `,
};

export default BottomTabBar;
