/**
 * 화면 주소를 한곳에서 관리한다. 라우터 정의(`AppRoutes`)와 링크, 이동이 모두 이 파일을 쓴다.
 * - 고정 주소는 `*_PATH` 상수로 두고 라우터 정의와 링크가 함께 쓴다.
 * - 매개변수가 있는 라우터 정의용 패턴은 `ROUTE_PATTERNS`에 둔다.
 * - 링크용 동적 주소는 `*Path()` 함수로 만든다.
 * - 화면이 읽는 쿼리 파라미터 이름은 `*_PARAM` 상수로 둔다.
 */

/** 로그인하면 보이는 홈. 로그인하지 않았으면 같은 주소에서 랜딩으로 보낸다. */
export const HOME_PATH = '/';
export const ADMIN_PATH = '/admin';
/** 본 방 기록(지도·리스트) 화면. */
export const RECORDS_PATH = '/properties';
export const CHECKLISTS_PATH = '/checklists';
export const CHECKLIST_CREATE_PATH = `${CHECKLISTS_PATH}/new`;
/** 서비스가 제공하는 기본 체크리스트. 수정하지 않고 보기만 한다. */
export const CHECKLIST_PROPERTY_ID_PARAM = 'propertyId';
export const propertyChecklistCreatePath = (propertyId: number) =>
  `${CHECKLIST_CREATE_PATH}?${CHECKLIST_PROPERTY_ID_PARAM}=${propertyId}`;
export const checklistDetailPath = (checklistId: number) => `${CHECKLISTS_PATH}/${checklistId}`;
export const MY_PATH = '/me';
export const COMPARE_PATH = '/compare';
/** 저렴한 한 끼. 탭마다 주소가 따로 있고(`/cheap-meals/restaurant` 등), 탭 없이 들어오면 마지막으로 연 탭(처음이면 식당 탭) 주소로 바꾼다. */
export const CHEAP_MEALS_PATH = '/cheap-meals';
export const GUIDE_PATH = '/guide';
export const PRIVACY_PATH = '/privacy';
export const MAP_SELECT_LOCATION_PATH = '/map/select-location';
export const EXPORT_PATH = '/export';
export const TIPS_PATH = '/tips';
/** 동네 찾기(회원). */
export const NEIGHBORHOODS_PATH = '/neighborhoods';
export const NEIGHBORHOODS_NEARBY_PATH = '/neighborhoods/nearby';
/** 동네 찾기(공개). */
export const EXPLORE_PATH = '/explore';
export const EXPLORE_NEARBY_PATH = '/explore/nearby';
/** 예전 주소. 들어오면 다른 화면으로 보낸다. */
export const LOGIN_PATH = '/login';
/** 광고로 들어오는 서비스 소개. 서비스 안에서는 홈 푸터의 `자취선배 소개`로 들어온다. */
export const LANDING_PATH = '/landing';
export const ABOUT_PATH = '/about';
/** 예전 매물 등록 화면. 매물은 본 방 기록 지도에서 등록하므로 기록 지도로 보낸다. */
export const PROPERTY_NEW_PATH = '/properties/new';
/** OAuth 인증을 마치고 돌아오는 화면. 결과를 정해 마이로 보낸다. 백엔드의 완료 주소(`OAUTH_SUCCESS_REDIRECT_URI`)가 이 주소다. */
export const OAUTH_COMPLETE_PATH = '/oauth/complete';

/** 라우터 정의에만 쓰는 패턴. `area`, `areaDetails`는 동네 찾기 주소 아래에 붙는 상대 패턴이다. */
export const ROUTE_PATTERNS = {
  propertyRecords: '/properties/:propertyId?',
  propertyEdit: '/properties/:propertyId/edit',
  propertyPhotos: '/properties/:propertyId/photos',
  propertyMemo: '/properties/:propertyId/memo',
  propertyNearby: '/properties/:propertyId/nearby',
  propertyActiveChecklist: '/properties/:propertyId/active-checklists/:stage',
  propertyActiveChecklistChild: 'active-checklists/:stage',
  propertyChecklist: '/properties/:propertyId/checklists/:propertyChecklistId',
  checklistDetail: '/checklists/:checklistId',
  legacyChecklists: '/checklists/*',
  legacyMap: '/map/:propertyId?',
  legacyExploreCommute: '/explore/commute/*',
  legacyExplorePrice: '/explore/price/*',
  legacyNeighborhoodsMap: '/neighborhoods/map/*',
  cheapMeals: '/cheap-meals/:mealTab?',
  area: 'areas/:adminDongCode',
  areaDetails: 'areas/:adminDongCode/details',
  notFound: '*',
} as const;

type PathId = number | string;

export const propertyDetailPath = (propertyId: PathId) => `${RECORDS_PATH}/${propertyId}`;
export const propertyChecklistTabPath = (propertyId: PathId) =>
  `${propertyDetailPath(propertyId)}?${PROPERTY_DETAIL_TAB_PARAM}=checklist`;
export const propertyEditPath = (propertyId: PathId) => `${propertyDetailPath(propertyId)}/edit`;
export const propertyPhotosPath = (propertyId: PathId) => `${propertyDetailPath(propertyId)}/photos`;
export const propertyMemoPath = (propertyId: PathId) => `${propertyDetailPath(propertyId)}/memo`;
export const propertyActiveChecklistPath = (propertyId: PathId, stage: string) =>
  `${propertyDetailPath(propertyId)}/active-checklists/${stage}`;
export const propertyChecklistPath = (propertyId: PathId, propertyChecklistId: PathId) =>
  `${propertyDetailPath(propertyId)}/checklists/${propertyChecklistId}`;

/** 저렴한 한 끼 탭 주소. 탭 이름은 `restaurant`, `convenience`, `delivery`이다. */
export const cheapMealsTabPath = (tab: string) => `${CHEAP_MEALS_PATH}/${tab}`;

/** 동네 찾기 주소. 회원은 `/neighborhoods`, 공개는 `/explore`이다. */
export type NeighborhoodBasePath = typeof EXPLORE_PATH | typeof NEIGHBORHOODS_PATH;
export const neighborhoodAreaPath = (base: string, adminDongCode: PathId) => `${base}/areas/${adminDongCode}`;
export const neighborhoodAreaDetailsPath = (base: string, adminDongCode: PathId) =>
  `${neighborhoodAreaPath(base, adminDongCode)}/details`;

/**
 * 서비스 안에서 랜딩으로 갈 때 라우터 state로 넘기는 값. 주소에 붙이지 않아 `$pageview` 경로는 광고 유입과 같은
 * `/landing`으로 남고, 랜딩 이벤트의 `entry`로 서비스 안 진입을 따로 센다. `returnTo`는 돌아갈 서비스 안 주소다.
 */
export type LandingEntry = 'home_footer';
export type LandingEntryState = { landingEntry: LandingEntry; returnTo: string };
export const landingEntryState = (landingEntry: LandingEntry, returnTo: string): LandingEntryState => ({
  landingEntry,
  returnTo,
});

/** 라우터 state에서 서비스 안 랜딩 진입을 읽는다. 다른 모양이거나 서비스 밖 주소면 진입 정보가 없는 것으로 본다. */
export const readLandingEntryState = (state: unknown): LandingEntryState | null => {
  if (typeof state !== 'object' || state === null) return null;
  const { landingEntry, returnTo } = state as Partial<Record<keyof LandingEntryState, unknown>>;
  if (landingEntry !== 'home_footer') return null;
  if (typeof returnTo !== 'string' || !returnTo.startsWith('/') || returnTo.startsWith('//')) return null;
  return { landingEntry, returnTo };
};

/** 매물 상세 탭(`?tab=`). */
export const PROPERTY_DETAIL_TAB_PARAM = 'tab';
/** 본 방 기록 보기 방식(`?view=`). */
export const RECORDS_VIEW_PARAM = 'view';
/** 본 방 기록을 지도 보기로 연다. 매물은 지도의 빈 곳을 눌러 등록한다. */
export const RECORDS_MAP_PATH = `${RECORDS_PATH}?${RECORDS_VIEW_PARAM}=map`;
/** 예전 저렴한 한 끼 탭(`/cheap-meals?tab=`). 들어오면 탭 주소로 바꾼다. */
export const CHEAP_MEALS_TAB_PARAM = 'tab';
/** 저렴한 한 끼 식당 탭에서 연 가게 상세(`?store=`)와 주소 검색(`?search=1`). 식당 탭 주소에만 붙는다. */
export const CHEAP_MEALS_STORE_PARAM = 'store';
export const CHEAP_MEALS_SEARCH_PARAM = 'search';
