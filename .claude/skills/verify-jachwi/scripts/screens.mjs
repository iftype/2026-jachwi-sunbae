// 주요 화면 목록. 기준 스크린샷(baseline.mjs)과 CI 자동 판정(ci-verdict.mjs)이 같이 쓴다.
// - url: 실제로 여는 주소. id는 MSW 목 데이터(frontend/src/app/mocks/fixtures)에 있는 값이다.
// - route: AppRoutes.tsx 의 라우트 패턴(visual-scope.mjs 가 내는 영향 라우트와 같은 글자).
// - moment: 사용자가 기다리는 순간. 보이는 요소의 CSS 선택자와, 있으면 그 요소 글자가 맞아야 하는 정규식(text)이다.
//   지도 SDK 없이도 뜨는 것만 둔다(CI는 지도 목이라 지도가 뜨지 않는다). 클래스 이름보다 aria-label, 제목 글자를 쓴다.
//   화면 제목처럼 데이터 없이 뜨는 것을 순간으로 둔 화면은 label에 그렇게 적는다.
// - 순서가 우선순위다. PR마다 도는 CI는 영향 라우트 중 이 목록에서 가장 앞선 화면 하나만 잰다.
// 라우트가 바뀌거나 순간 요소가 바뀌면 여기를 고친다. 갈 수 없는 화면은 넣지 않는다(넣어도 baseline.mjs 확인에서 빠진다).
export const SCREENS = [
  {
    name: 'home',
    url: '/',
    route: '/',
    moment: { label: '목록의 첫 매물 카드(사진 자리까지 보인 카드)', selector: 'article img' },
  },
  {
    name: 'property-detail',
    url: '/properties/11',
    route: '/properties/:propertyId',
    moment: { label: '매물 상세 제목(목 매물 이름)', selector: 'h1', text: '망원동 투룸' },
  },
  {
    name: 'checklists',
    url: '/checklists',
    route: '/checklists',
    moment: { label: '내 체크리스트 개수', selector: 'h2', text: '내 체크리스트\\s*\\d+개' },
  },
  {
    name: 'compare',
    url: '/compare',
    route: '/compare',
    moment: { label: '비교할 매물 목록의 첫 줄', selector: 'ul[aria-label="비교할 매물 목록"] li' },
  },
  {
    name: 'neighborhoods',
    url: '/neighborhoods',
    route: '/neighborhoods',
    moment: { label: '출퇴근 장소 입력 칸(화면 제목)', selector: 'section[aria-label="출퇴근 장소"]' },
  },
  {
    name: 'explore',
    url: '/explore',
    route: '/explore',
    moment: { label: '출퇴근 장소 입력 칸(화면 제목)', selector: 'section[aria-label="출퇴근 장소"]' },
  },
  {
    name: 'property-edit',
    url: '/properties/11/edit',
    route: '/properties/:propertyId/edit',
    moment: { label: '수정 폼 제목', selector: 'h1', text: '매물 정보를 수정해주세요' },
  },
  {
    name: 'property-photos',
    url: '/properties/11/photos',
    route: '/properties/:propertyId/photos',
    moment: { label: '사진 관리 제목(목 매물 이름)', selector: 'h1', text: '망원동 투룸' },
  },
  {
    name: 'checklist-detail',
    url: '/checklists/9',
    route: '/checklists/:checklistId',
    moment: { label: '추가된 체크리스트 제목', selector: '#selected-items-heading' },
  },
  {
    name: 'checklist-new',
    url: '/checklists/new',
    route: '/checklists/new',
    moment: { label: '체크 항목 검색 제목', selector: '#item-picker-heading' },
  },
  {
    name: 'me',
    url: '/me',
    route: '/me',
    moment: { label: '마이페이지 패널', selector: 'section[aria-label="목록 안의 마이페이지"]' },
  },
  {
    name: 'search',
    url: '/search',
    route: '/search',
    moment: { label: '내 기록 목록', selector: 'section[aria-label="내 기록"]' },
  },
  {
    name: 'cheap-meals',
    url: '/cheap-meals/restaurant',
    route: '/cheap-meals/:mealTab?',
    moment: { label: '착한가격 가게 수', selector: 'h2', text: '착한가격 가게\\s*\\d+곳' },
  },
  {
    name: 'guide',
    url: '/guide',
    route: '/guide',
    moment: { label: '사용 방법 제목(화면 제목)', selector: 'h1', text: '사용 방법' },
  },
  { name: 'landing', url: '/landing', route: '/landing' },
  { name: 'privacy', url: '/privacy', route: '/privacy' },
];

export const findScreen = (nameOrRoute) =>
  SCREENS.find((screen) => screen.name === nameOrRoute || screen.route === nameOrRoute || screen.url === nameOrRoute);

// 영향 라우트 중 순간이 정해진 화면을 우선순위 순서로 고른다. all 이면 순간이 있는 화면 전체다.
export const pickScreens = ({ scope, routes }) =>
  SCREENS.filter((screen) => screen.moment && (scope === 'all' || routes.includes(screen.route)));
