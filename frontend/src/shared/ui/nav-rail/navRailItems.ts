import iconProfile from '@/shared/assets/icon-profile.webp';
import addPropertyIcon from '@/shared/assets/illustrations/add-property.webp';
import iconHome from '@/shared/assets/illustrations/icon-home.webp';
import iconMap from '@/shared/assets/illustrations/icon-map.webp';
import cheapMealIcon from '@/shared/assets/illustrations/nav-cheap-meal.webp';
import checklistIcon from '@/shared/assets/illustrations/nav-checklist.webp';
import guideIcon from '@/shared/assets/illustrations/nav-guide.webp';
import { PROPERTY_PLACEHOLDER } from '@/shared/assets/propertyImageAssets';
import { CHEAP_MEALS_PATH, CHECKLISTS_PATH, COMPARE_PATH, GUIDE_PATH } from '@/shared/lib/navigation/appPaths';

/**
 * 데스크탑 네비 레일의 칸. 실제 레일과 뼈대가 같은 그림과 글자를 쓴다.
 * 지도 화면(내 기록, 동네 찾기)과 마이는 화면이 직접 이동을 정하고, 도구 화면(체크리스트, 방 비교, 저렴한 한 끼, 사용방법)은 `path`로 간다.
 * `isBottom`인 칸은 레일 맨 아래에 붙인다.
 */
export type NavRailEntry = {
  key: string;
  label: string;
  image: string;
  path?: string;
  isBottom?: boolean;
  isPrimary?: boolean;
};

export const NAV_RAIL_ITEMS: readonly NavRailEntry[] = [
  // 지도에서 바로 본 방을 기록하기 시작하는 동작 칸. 이동이 아니라 기록 지도에서 등록을 여는 칸이라 눈에 띄게 칠한다.
  { key: 'register', label: '본 방 기록하기', image: addPropertyIcon, isPrimary: true },
  { key: 'records', label: '내 기록', image: iconHome },
  { key: 'neighborhoods', label: '동네 찾기', image: iconMap },
  { key: 'checklists', label: '체크리스트', image: checklistIcon, path: CHECKLISTS_PATH },
  { key: 'compare', label: '방 비교', image: PROPERTY_PLACEHOLDER.src, path: COMPARE_PATH },
  { key: 'meals', label: '저렴한 한 끼', image: cheapMealIcon, path: CHEAP_MEALS_PATH },
  { key: 'my', label: '마이', image: iconProfile },
  { key: 'guide', label: '사용방법', image: guideIcon, path: GUIDE_PATH, isBottom: true },
];
