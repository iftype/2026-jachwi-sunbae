import type { IconName } from '@/shared/ui/icon/Icon';

/** 하단 주요 메뉴. */
export const MAIN_TABS = [
  { key: 'home', path: '/properties', label: '홈', icon: 'home' },
  { key: 'checklists', path: '/checklists', label: '체크리스트', icon: 'checklist' },
  { key: 'map', path: '/map', label: '지도', icon: 'map' },
  { key: 'neighborhoods', path: '/neighborhoods', label: '동네 찾기', icon: 'locate' },
  { key: 'me', path: '/me', label: '마이', icon: 'user' },
] as const satisfies readonly { key: string; path: string; label: string; icon: IconName }[];
