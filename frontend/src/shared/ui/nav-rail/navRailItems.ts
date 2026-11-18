import iconProfile from '@/shared/assets/icon-profile.webp';
import iconCompare from '@/shared/assets/illustrations/icon-compare.webp';
import iconHome from '@/shared/assets/illustrations/icon-home.webp';
import iconMap from '@/shared/assets/illustrations/icon-map.webp';
import cheapMealIcon from '@/shared/assets/illustrations/nav-cheap-meal.webp';
import checklistIcon from '@/shared/assets/illustrations/nav-checklist.webp';
import guideIcon from '@/shared/assets/illustrations/nav-guide.webp';
import { CHEAP_MEALS_PATH, CHECKLISTS_PATH, COMPARE_PATH, GUIDE_PATH } from '@/shared/lib/navigation/appPaths';

/**
 * 데스크탑 네비 레일의 칸. 실제 레일과 뼈대가 같은 그림과 글자를 쓴다.
 * 지도 화면(내 기록, 동네 찾기)과 마이는 화면이 직접 이동을 정하고, 도구 화면(체크리스트, 방 비교, 저렴한 한 끼, 사용방법)은 `path`로 간다.
 * `isBottom`인 칸은 위쪽 목록이 아니라 레일 맨 아래 (footer)에 세로로 쌓는다.
 */
export type NavRailEntry = {
  key: string;
  label: string;
  image: string;
  path?: string;
  isBottom?: boolean;
};

export const NAV_RAIL_ITEMS: readonly NavRailEntry[] = [
  { key: 'records', label: '내 기록', image: iconHome },
  { key: 'neighborhoods', label: '동네 찾기', image: iconMap },
  { key: 'checklists', label: '체크리스트', image: checklistIcon, path: CHECKLISTS_PATH },
  { key: 'compare', label: '방 비교', image: iconCompare, path: COMPARE_PATH },
  { key: 'meals', label: '저렴한 한 끼', image: cheapMealIcon, path: CHEAP_MEALS_PATH },
  // 레일 맨 아래에 `사용방법 | 마이`를 세로로 쌓는다(위에 사용방법, 아래에 마이).
  { key: 'guide', label: '사용방법', image: guideIcon, path: GUIDE_PATH, isBottom: true },
  { key: 'my', label: '마이', image: iconProfile, isBottom: true },
];

/** 위쪽 목록. 휴대폰 하단 탭도 이 목록에서 고른다. */
export const NAV_RAIL_MAIN_ITEMS = NAV_RAIL_ITEMS.filter((item) => item.isBottom !== true);
/** 레일 맨 아래(`footer`)에 세로로 쌓는 목록. */
export const NAV_RAIL_FOOTER_ITEMS = NAV_RAIL_ITEMS.filter((item) => item.isBottom === true);
