import { css } from '@emotion/css';

import { MOBILE_BOTTOM_TAB_HEIGHT } from './bottomTabConfig';

export type BottomTab = {
  key: string;
  label: string;
  image: string;
  isActive: boolean;
  onSelect: () => void;
};

type Props = { tabs: readonly BottomTab[]; hidden: boolean };

/** 휴대폰 화면 아래에 붙는 탭 바. 높이는 56px에 아래 안전 영역을 더하고, 숨길 때는 아래로 내려 레이아웃이 튀지 않게 한다. */
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
        <img src={tab.image} alt="" width={24} height={24} />
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
    height: calc(${MOBILE_BOTTOM_TAB_HEIGHT}px + env(safe-area-inset-bottom));
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
    gap: 2px;
    min-width: 44px;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-muted);
    font: inherit;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1.2;
    white-space: nowrap;
    cursor: pointer;

    & img {
      width: 24px;
      height: 24px;
      object-fit: contain;
      opacity: 0.55;
    }
    &[aria-current='page'] {
      color: var(--color-primary);
    }
    &[aria-current='page'] img {
      opacity: 1;
    }
    &:focus-visible {
      outline: 2px solid var(--color-focus);
      outline-offset: -2px;
    }
  `,
};

export default BottomTabBar;
