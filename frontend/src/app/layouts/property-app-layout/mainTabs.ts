import type { IconName } from '@/shared/ui/icon/Icon';

/**
 * 하단 주요 메뉴. 웹 하단바와 앱의 네이티브 탭바가 같은 `key`를 쓴다.
 * 키를 바꾸면 `mobile/` 탭바의 키도 함께 바꾼다.
 */
export const MAIN_TABS = [
  { key: 'home', path: '/properties', label: '홈', icon: 'home' },
  { key: 'checklists', path: '/checklists', label: '체크리스트', icon: 'checklist' },
  { key: 'map', path: '/map', label: '지도', icon: 'map' },
  { key: 'neighborhoods', path: '/neighborhoods', label: '동네 찾기', icon: 'locate' },
  { key: 'me', path: '/me', label: '마이', icon: 'user' },
] as const satisfies readonly { key: string; path: string; label: string; icon: IconName }[];

export type MainTabKey = (typeof MAIN_TABS)[number]['key'];

export const findActiveTab = (pathname: string): MainTabKey | null =>
  MAIN_TABS.find((tab) => pathname === tab.path || pathname.startsWith(`${tab.path}/`))?.key ?? null;

export const findMainTab = (key: string) => MAIN_TABS.find((tab) => tab.key === key);
