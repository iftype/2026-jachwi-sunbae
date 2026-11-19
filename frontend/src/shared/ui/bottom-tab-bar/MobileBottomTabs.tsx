import { useEffect, useLayoutEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';
import { isRunningInNativeApp } from '@/shared/lib/native-app/nativeApp';
import { MY_PATH, NEIGHBORHOODS_PATH, RECORDS_PATH } from '@/shared/lib/navigation/appPaths';

import type { IconName } from '../icon/Icon';
import { NAV_RAIL_ITEMS } from '../nav-rail/navRailItems';
import BottomTabBar from './BottomTabBar';
import type {
  MOBILE_BOTTOM_TAB_KEYS} from './bottomTabConfig';
import {
  bottomTabKeys,
  isMobileBottomTabsPath,
  MOBILE_BOTTOM_TABS_ENABLED,
  MOBILE_TAB_SPACE,
  MOBILE_TAB_SPACE_VAR,
} from './bottomTabConfig';

const TAB_ICONS = {
  records: 'home',
  neighborhoods: 'map',
  checklists: 'checklist',
  compare: 'replace',
  meals: 'utensils',
  my: 'user',
} satisfies Record<(typeof MOBILE_BOTTOM_TAB_KEYS)[number], IconName>;

const TEXT_ENTRY =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea, select, [contenteditable="true"]';
const FULLSCREEN_MODAL = '[aria-modal="true"], dialog[open]';

/** 입력창에 포커스가 가서 키보드가 올라온 동안, 그리고 전체 화면 모달이 열려 있는 동안 true. */
const useCoveredByKeyboardOrModal = (enabled: boolean) => {
  const [covered, setCovered] = useState(false);
  useEffect(() => {
    if (!enabled) return undefined;
    let focusTimer: number | undefined;
    const syncModal = () => document.querySelector(FULLSCREEN_MODAL) !== null;
    const update = (focused: boolean) => setCovered(focused || syncModal());
    const onFocusIn = (event: FocusEvent) => {
      window.clearTimeout(focusTimer);
      update(event.target instanceof Element && event.target.matches(TEXT_ENTRY));
    };
    // 입력창 사이로 포커스가 옮겨 가는 동안 탭이 깜박이지 않게 한 틱 미룬다.
    const onFocusOut = () => {
      window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => {
        const active = document.activeElement;
        update(active instanceof Element && active.matches(TEXT_ENTRY));
      }, 80);
    };
    const observer = new MutationObserver(() => update(document.activeElement?.matches(TEXT_ENTRY) ?? false));
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-modal', 'open'],
    });
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    update(document.activeElement?.matches(TEXT_ENTRY) ?? false);
    return () => {
      window.clearTimeout(focusTimer);
      observer.disconnect();
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, [enabled]);
  return covered;
};

type Props = {
  /** 통합 지도처럼 화면이 마지막 주소를 기억하면, 탭을 눌렀을 때 갈 주소를 직접 정한다. */
  recordsTo?: string;
  neighborhoodsTo?: string;
};

/**
 * 휴대폰 하단 탭. 위쪽 네비 목록(`navRailItems`)에서 `bottomTabKeys`가 고른 칸만(앱은 내 기록, 동네 찾기, 마이 셋) 같은 그림과 글자로 쓴다.
 * 보이는 동안 `<html>`에 `--mobile-tab-space`를 걸어, 지도의 아래 요소들이 탭 높이만큼 함께 올라가게 한다.
 */
const MobileBottomTabs = ({ recordsTo = RECORDS_PATH, neighborhoodsTo = NEIGHBORHOODS_PATH }: Props) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const enabled = MOBILE_BOTTOM_TABS_ENABLED && !isDesktop && isMobileBottomTabsPath(pathname);
  const covered = useCoveredByKeyboardOrModal(enabled);
  const visible = enabled && !covered;

  useLayoutEffect(() => {
    if (!MOBILE_BOTTOM_TABS_ENABLED || isDesktop) return undefined;
    const root = document.documentElement;
    // 숨기면 변수를 지워, 각 요소가 원래 아래 안전 영역 기준으로 돌아간다.
    if (visible) root.style.setProperty(MOBILE_TAB_SPACE_VAR, MOBILE_TAB_SPACE);
    else root.style.removeProperty(MOBILE_TAB_SPACE_VAR);
    if (enabled) root.dataset.mobileTabs = 'on';
    return () => {
      root.style.removeProperty(MOBILE_TAB_SPACE_VAR);
      delete root.dataset.mobileTabs;
    };
  }, [visible, enabled, isDesktop]);

  if (!enabled) return null;
  const targets: Partial<Record<(typeof MOBILE_BOTTOM_TAB_KEYS)[number], string>> = {
    records: recordsTo,
    neighborhoods: neighborhoodsTo,
    my: MY_PATH,
  };
  const tabs = bottomTabKeys(isRunningInNativeApp()).flatMap((key) => {
    const item = NAV_RAIL_ITEMS.find((entry) => entry.key === key);
    if (!item) return [];
    const path = item.path ?? targets[key] ?? RECORDS_PATH;
    const base = key === 'records' ? RECORDS_PATH : key === 'neighborhoods' ? NEIGHBORHOODS_PATH : (item.path ?? path);
    return [
      {
        key,
        label: item.label,
        icon: TAB_ICONS[key],
        isActive: item.path !== undefined || key === 'neighborhoods' ? pathname.startsWith(base) : pathname === base,
        onSelect: () => navigate(path),
      },
    ];
  });
  return <BottomTabBar tabs={tabs} hidden={!visible} />;
};

export default MobileBottomTabs;
