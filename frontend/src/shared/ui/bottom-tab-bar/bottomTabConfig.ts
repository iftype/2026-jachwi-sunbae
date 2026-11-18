import {
  CHEAP_MEALS_PATH,
  CHECKLISTS_PATH,
  COMPARE_PATH,
  MY_PATH,
  NEIGHBORHOODS_PATH,
  RECORDS_PATH,
} from '@/shared/lib/navigation/appPaths';

/**
 * 휴대폰 하단 탭 바를 쓸지 정하는 스위치. 시험용이라 `false`로 바꾸면 예전 구조(헤더 왼쪽 모드 타일, 위 이동 링크)로 돌아간다.
 */
export const MOBILE_BOTTOM_TABS_ENABLED = true;

/** 탭 바 높이(px). 아래 안전 영역은 `MOBILE_TAB_SPACE`에서 더한다. */
export const MOBILE_BOTTOM_TAB_HEIGHT = 56;

/**
 * 탭 바가 차지하는 아래 공간. 탭 바가 보이면 이 값, 숨기면 0px로 `<html>`의 `--mobile-tab-space`에 걸린다.
 * 지도의 아래 요소(`--map-sheet-bottom`, `--map-mode-bottom`)가 모두 이 변수 하나를 따른다.
 */
export const MOBILE_TAB_SPACE_VAR = '--mobile-tab-space';
export const MOBILE_TAB_SPACE = `calc(${MOBILE_BOTTOM_TAB_HEIGHT}px + env(safe-area-inset-bottom))`;

/** 탭 바에 둘 화면 키. `navRailItems`의 위쪽 목록에서 이 순서대로 골라 쓴다. 6번째 탭은 여기에 키만 더하면 된다. */
export const MOBILE_BOTTOM_TAB_KEYS = ['records', 'neighborhoods', 'checklists', 'compare', 'meals'] as const;

/** 탭을 보여 주는 화면 주소. 이 밖의 화면(매물 상세, 등록과 수정, 검색, 전체 화면)에서는 숨긴다. */
export const isMobileBottomTabsPath = (pathname: string) =>
  pathname === RECORDS_PATH ||
  pathname === MY_PATH ||
  pathname === COMPARE_PATH ||
  pathname === CHECKLISTS_PATH ||
  pathname === NEIGHBORHOODS_PATH ||
  pathname.startsWith(`${NEIGHBORHOODS_PATH}/areas/`) ||
  pathname === CHEAP_MEALS_PATH ||
  pathname.startsWith(`${CHEAP_MEALS_PATH}/`);
