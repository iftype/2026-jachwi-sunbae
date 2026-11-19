# 프론트엔드 컨벤션

현재 프로젝트에서 코드를 읽고 작성하는 기준입니다. 규칙은 목적 없이 늘리지 않고, 작업 중 반복해서 문제가 생기는 지점부터 추가합니다.

## 1. 디렉터리 구조

```text
frontend/
├── public/                 # URL로 직접 제공할 정적 파일
├── src/
│   ├── app/                # 앱 조립: router, providers, layouts, analytics, styles
│   ├── pages/              # URL과 대응하는 페이지와 페이지 전용 UI
│   ├── features/           # auth, checklist, map, property 등 기능 단위 코드
│   └── shared/             # 도메인에 독립적인 api, config, lib, ui, assets
├── test/                   # src와 동일한 경로를 따르는 테스트
├── webpack.config.js
└── tsconfig.json
```

이 프로젝트는 FSD의 레이어와 슬라이스 개념만 가져온 `fsd-lite` 구조를 사용합니다.

- `app`: 실행에 필요한 조립 코드만 둡니다. 도메인 상태나 재사용 UI를 두지 않습니다.
- `pages`: 라우트 진입점입니다. 해당 페이지에서만 쓰는 화면은 페이지 내부 `ui`, 상태 로직은 `hooks`에 둡니다.
- `features`: 사용자 기능 또는 도메인별 슬라이스입니다. 각 슬라이스는 필요한 `api`, `model`, `lib`, `ui` 세그먼트만 가집니다.
- `shared`: 특정 도메인을 모르는 기반 코드입니다. 공통 UI는 반드시 `shared/ui/<component>` 폴더 단위로 둡니다.

의존 방향은 `app → pages → features → shared`입니다. 하위 레이어는 상위 레이어를 import하지 않습니다. 기능 간 결합이 필요한 경우에는 소유 도메인이 분명한 쪽을 직접 참조하되, 순환 의존성을 만들지 않습니다.

파일을 둘 위치는 다음 순서로 판단합니다.

1. 한 페이지에서만 사용하는가? `pages/<page>/ui`
2. 특정 기능·도메인에 속하는가? `features/<feature>/<segment>`
3. 도메인과 무관하게 재사용 가능한가? `shared/<segment>`
4. 라우팅·Provider·전역 레이아웃처럼 앱을 조립하는가? `app/<segment>`

공유 기능 컴포넌트는 `features/map/ui/map-canvas/MapCanvas.tsx`, 페이지 전용 컴포넌트는 `pages/design-records/ui/record-list/RecordList.tsx`, 공용 UI는 `shared/ui/button/Button.tsx`처럼 둡니다. 컴포넌트의 스타일은 별도 파일 없이 컴포넌트 파일 안에 둡니다.

`public`은 `/logo.svg`처럼 URL로 직접 제공하는 파일이고, `shared/assets`는 코드에서 import하여 Webpack이 처리하는 이미지·폰트입니다.

화면 주소는 `shared/lib/navigation/appPaths.ts`에서만 정합니다. 라우터 정의(`app/router/AppRoutes.tsx`)와 링크, 이동은 문자열 대신 고정 주소 상수(`CHECKLISTS_PATH`), 라우터 패턴(`ROUTE_PATTERNS`), 동적 주소 함수(`propertyDetailPath(id)`), 쿼리 파라미터 이름(`PROPERTY_DETAIL_TAB_PARAM`)을 씁니다. 테스트(`test`)는 상수를 잘못 바꿔도 잡을 수 있도록 주소 문자열을 그대로 씁니다.

테스트 파일은 구현 파일과 함께 두지 않고 `test` 아래에서 `src`와 동일한 경로를 유지합니다. 예를 들어 `src/features/map/lib/mapClustering.ts`의 테스트는 `test/features/map/lib/mapClustering.test.ts`에 둡니다. 공통 테스트 설정과 서버는 각각 `test/setup.ts`, `test/server.ts`에 둡니다.

## 2. 네이밍

### 파일과 폴더

- 컴포넌트 파일: `PascalCase` — `PostCard.tsx`
- 함수·변수 파일: `camelCase` — `formatDate.ts`
- 폴더: `kebab-case` — `post-detail/`
- Hook 파일: `usePascalCase` — `usePost.ts`
- 타입: `PascalCase` — `Post`, `PostDetailProps`
- Boolean: `is`, `has`, `can`, `should` 접두사 — `isLoading`, `hasNextPage`
- 상수: 의미가 분명하면 `camelCase`, 전역 불변 값은 `UPPER_SNAKE_CASE`

### API 함수

- GET: `fetch` — `fetchPostDetail.ts`
- POST: `submit` 또는 `create` — `submitPost.ts`
- DELETE: `remove` — `removePost.ts`
- PUT/PATCH: `update` — `updatePostDetail.ts`

API 함수는 컴포넌트에서 직접 호출하지 않고 API 모듈이나 Query Hook을 통해 사용합니다.

## 3. 모듈과 export

- 컴포넌트: `default export`
- 일반 함수·상수·타입: `named export`
- 타입만 가져올 때는 `import type` 사용
- 다른 slice나 레이어는 `@/` 별칭(`src/`)으로, 같은 slice 안은 상대 경로로 가져옵니다. 예: `pages/design-records`에서 `@/features/map/...`, `./hooks/useRecords`
- import 순서는 `simple-import-sort`가 정리합니다. 외부 패키지 → `@/app`·`@/pages`·`@/features`·`@/shared` → 상대 경로 → 공유 스타일(`*.styles`) 순서이며 `npm run lint:fix`로 맞춥니다.

```tsx
import { useState } from 'react';

import type { MapAddress } from '@/features/map/model/Map';
import TopNavigation from '@/shared/ui/top-navigation/TopNavigation';

import useMapFilters from './hooks/useMapFilters';

import * as shared from '../MapPage.styles';
```

- 기능의 DTO 변환처럼 내부 사정은 페이지로 꺼내지 않습니다. `useUpdateProperty`, `useCreateChecklist`처럼 기능의 Hook이 화면 모델을 받아 API 형식으로 바꿉니다.

불필요한 `index.ts` 재-export와 순환 의존성은 만들지 않습니다.

## 4. React 컴포넌트

- 컴포넌트는 화살표 함수로 선언합니다.
- Props 타입을 선언하고 구조분해 할당합니다.
- 컴포넌트는 화면 표현에 집중하고, API 호출과 복잡한 상태 로직은 Hook으로 분리합니다.
- 하나의 컴포넌트가 너무 커지면 화면·도메인·표현 책임을 나눕니다.
- 페이지가 커지면 JSX를 통째로 옮기지 말고, 함께 바뀌는 상태를 `pages/<page>/hooks`의 Hook으로 먼저 묶습니다. Hook은 setter나 ref 대신 `selectRadius`, `enter`, `cancel`처럼 의도가 드러나는 함수를 반환합니다.
- 페이지는 Hook과 화면 영역 컴포넌트를 직접 조립합니다. props를 그대로 넘기기만 하는 중간 컴포넌트는 만들지 않습니다.
- 지도 Hook은 `moveToCoordinate`, `openSearch`, `expandSheet`처럼 동작을 공개합니다. 비동기 실패 시 최신 매물 좌표는 `getFallbackCoordinate`로 읽고 데이터 ref는 Hook 내부에 둡니다. DOM 연결에 필요한 시트 ref는 예외로 노출합니다.

```tsx
type PostCardProps = {
  title: string;
  onClick: () => void;
};

const PostCard = ({ title, onClick }: PostCardProps) => {
  return (
    <button type="button" onClick={onClick}>
      {title}
    </button>
  );
};

export default PostCard;
```

## 5. TypeScript

기준과 항목별 근거, 런타임 검증 위치, 타입 검사가 일어나는 지점은 [TypeScript 사용 기준](typescript.md)에 정리했습니다. 아래는 요약입니다.

- 객체 타입은 `type`으로 선언하고, `enum` 대신 문자열 리터럴 유니온과 `as const`를, 타입만 가져올 때는 `import type`을 씁니다.
- `any`, non-null assertion(`!`), `@ts-ignore`는 쓰지 않습니다. ESLint가 막습니다.
- 외부에서 들어온 값(API 응답, 브라우저 저장소, URL, 네이티브 브리지)은 `unknown`으로 받아 파서나 타입 가드로 검증하고, 타입 단언(`as`)으로 타입을 붙이지 않습니다.
- 타입은 사용하는 범위와 같은 슬라이스의 `model`에 둡니다. 도메인과 무관한 설정 타입만 `shared`에 둡니다.
- 타입 검사와 Babel 변환을 구분합니다. Babel은 타입을 검사하지 않으므로 `npm run build`가 번들 생성 전에 `npm run typecheck`를 실행합니다. 개발 중 타입 오류만 빠르게 확인할 때는 `npm run typecheck`를 직접 실행합니다.

## 6. 스타일

스타일은 Emotion(`@emotion/css`)으로 작성합니다. 별도의 `.css` 파일은 두지 않습니다.

- 컴포넌트 하나만 쓰는 스타일은 그 컴포넌트 파일 아래에 `const styles = { ... }`로 두고 `className={styles.name}`으로 씁니다. 모듈 최상단 코드에서 스타일을 써야 하면 import 바로 아래에 둡니다.
- 여러 파일이 함께 쓰는 스타일만 `<Name>.styles.ts`로 분리해 `export const name = css\`...\``로 내보내고 `import * as shared from './<Name>.styles'`로 가져옵니다.
- 스타일 이름은 `camelCase`, 블록 첫 줄에는 개발 도구에서 찾을 수 있게 `label: <Component>-<name>;`을 둡니다.
- 같은 요소의 상태·하위 요소 스타일은 `&:hover`, `&[data-state='open']`, `& > span`처럼 블록 안에 중첩합니다.
- 다른 요소의 스타일을 선택자에서 가리켜야 하면, 가리켜지는 쪽을 `cx(css\`...\`, '<Component>-<name>')`로 만들어 고정 클래스 이름을 함께 붙이고 선택자에는 그 이름(`.<Component>-<name> &`)을 씁니다. `@emotion/css`에서 `${styles.other}`를 템플릿에 넣으면 선택자가 아니라 그 스타일을 합치므로 선택자로 쓰지 않습니다.
- 지역 애니메이션은 `keyframes`로 만들고 `animation: ${fadeInKeyframes} ...`처럼 씁니다.
- 페이지 컴포넌트는 데이터와 하위 화면을 조합하고, 독립된 화면 영역은 스타일과 함께 기능 컴포넌트로 분리합니다.
- 페이지 스타일이 250줄을 넘거나 서로 독립적으로 설명할 수 있는 화면 영역이 둘 이상 섞이면 컴포넌트 분리를 검토합니다. 줄 수 자체보다 책임의 개수를 우선 판단합니다.
- 디자인 토큰은 `src/app/styles/tokens.styles.ts`, 요소 기본값은 `src/app/styles/global.styles.ts`, 여러 화면에서 재사용하는 유틸리티 클래스는 `src/app/styles/utilities.styles.ts`에 `injectGlobal`로 둡니다.
- 전역 클래스는 실제로 여러 화면에서 같은 의미와 형태로 재사용할 때만 추가합니다.
- 스타일 목적으로 ID 선택자를 사용하지 않습니다.
- 페이지 전용 UI를 분리할 때 전용 스타일도 함께 옮깁니다. 하위 UI에서 상위 페이지 스타일을 가져오지 않고, 페이지에는 영역 배치와 간격을 담당하는 스타일을 남깁니다.
- `rem`: 폰트 크기와 주요 간격
- `px`: 테두리처럼 고정되어야 하는 얇은 선
- `%`, `vw`, `vh`: 부모나 화면 크기에 반응해야 하는 영역
- 색상·간격·radius처럼 반복되는 값은 CSS 변수로 관리합니다.

```tsx
import { css } from '@emotion/css';

const PostCard = () => <article className={styles.card}>...</article>;

const styles = {
  card: css`
    label: PostCard-card;
    padding: var(--space-md);
    border-radius: var(--radius-md);

    &:hover {
      background: var(--color-surface);
    }
  `,
};

export default PostCard;
```

### 데스크탑과 휴대폰

- 데스크탑(1024px 이상)과 휴대폰·태블릿 화면이 다르면 미디어 쿼리로 나누지 않고 컴포넌트로 나눕니다. 페이지 진입점에서 `useIsDesktop()`으로 한 번만 고르고, 화면은 `pages/<page>/desktop/<Name>DesktopPage.tsx`, `pages/<page>/mobile/<Name>MobilePage.tsx`에 둡니다.
- 두 화면이 함께 쓰는 조각은 `pages/<page>/ui`에, 두 화면이 함께 쓰는 페이지 스타일은 `<Page>.styles.ts`에 두고 각 화면이 `import * as shared from '../<Page>.styles'`로 가져옵니다. 화면별로 다른 값만 각 화면 컴포넌트 안의 스타일에 둡니다.
- 앱 셸도 같은 기준으로 `app/layouts/property-app-layout/desktop`, `mobile`에 나눠 둡니다.
- 태블릿(768px)이나 아주 좁은 휴대폰처럼 휴대폰 화면 안에서의 폭 차이는 해당 스타일 안의 `@media`로 다룹니다. `@media (min-width: 1024px)`는 쓰지 않습니다.

```tsx
const DesignHomePage = () => (useIsDesktop() ? <HomeDesktopPage /> : <HomeMobilePage />);
```

## 7. API와 상태 처리

- API 통신 코드와 DTO는 소유 기능의 `features/<feature>/api`에 둡니다.
- `apiBaseUrl` 같은 공개 설정은 props로 넘기지 않고 `usePublicConfig()`로 읽습니다. Query Hook은 내부에서 읽고, API 함수(`fetch*`, `get*QueryOptions`)는 순수 함수로 두어 `config`를 인자로 받습니다. 테스트는 `PublicConfigProvider`로 감쌉니다.
- 서버 응답 형식과 화면 모델이 다르면 API 경계에서 변환합니다.
- 조회·변경 Query Hook도 같은 기능의 `api`에 둡니다.
- 화면에는 최소한 loading, error, empty, success 상태를 고려합니다.
- 페이지 전체를 조회 결과로 그릴 때는 `shared/ui/query-state/QueryState`로 로딩·오류 화면을 맡깁니다. 오류 안내는 `describePropertyLoadError`, `describeChecklistLoadError`처럼 소유 기능의 `api`에서 만듭니다. 기다리는 동안 로딩을 늦추지 않고 바로 보여 주며, 화면 뼈대가 있으면 `skeleton`으로 넘겨 로딩 문구 대신 뼈대를 그립니다.
- 지연 로딩(`DelayedFallback`, `useDelayedLoading`)은 이미 화면에 남아 있는 요소 안에서 짧은 로딩이 번쩍이지 않게 할 때만 씁니다. 페이지를 바꾸거나 새로 여는 로딩(라우트 대체 화면, 페이지 전체 조회)에는 남겨 둘 내용이 없어 늦추면 빈 화면만 길어지므로 쓰지 않습니다.
- 남아 있는 화면의 일부만 불러올 때는 `shared/ui/delayed-fallback/DelayedFallback`으로 감쌉니다. 300ms 안에 끝나면 로딩 UI 없이 빈자리(`placeholder`)만 두었다가 바로 내용을 보여 주고, 그보다 길어지면 `fallback`을 띄워 최소 250ms는 남깁니다. 오류 처리는 맡지 않습니다. 감싸기 어려운 곳(지도 위 안내, 사진 등)은 같은 규칙의 `useDelayedLoading`을 씁니다. 같은 자리라도 처음 열어 보여 줄 내용이 없을 때는 늦추지 않습니다. 예: 저렴한 한 끼 식당 탭의 첫 목록
- 공용 `Button`의 `isLoading`은 켜지는 즉시 두 번째 클릭을 막고 `aria-busy`를 달지만, 스피너와 문구, 비활성 모양은 300ms가 지나야 보여 줍니다. 라우트 Suspense 대체 화면(`RouteLoading`)은 늦추지 않고 바로 보여 주고, 뼈대가 있는 경로는 그 뼈대를 대체 화면으로 넘깁니다.
- 화면 뼈대는 라우트 Suspense 대체 화면과 데이터 로딩에 같은 것을 써서 뼈대에서 내용으로 한 번만 바뀌게 합니다. 라우트 대체 화면은 첫 번들(380KiB 한도)에 들어가므로, 뼈대가 무거우면 데이터 로딩에만 씁니다. 예: 체크리스트의 `ChecklistEditorSkeleton`
- 몇 개가 올지 모르는 목록은 카드 뼈대를 두지 않습니다. 개수가 다르면 뼈대에서 내용으로 바뀔 때 칸이 펼쳐졌다 줄어듭니다. 남아 있는 화면 안의 목록이면 `DelayedFallback`을 쓰고, 아래가 크게 밀리면 데이터 전 최소 높이만 한 줄 정도로 잡습니다. 예: 홈 `RecentRooms`
- `index.html`의 `#root`에는 JS를 받는 동안 보여 줄 CSS 앱 뼈대(`.boot-skeleton`)를 둡니다. 홈 뼈대는 실제 첫 화면과 같은 자리와 크기로 맞추고, 홈 라우트의 대체 화면(`HomePageSkeleton`)도 같은 마크업을 써서 JS를 받기 전부터 홈이 그려질 때까지 모양이 그대로 이어지게 합니다.
- 회원 화면 입구(`ProtectedRoute`)는 자동 로그인을 기다리는 동안에도 화면을 그립니다. 화면의 요청은 API 클라이언트가 진행 중인 로그인을 기다렸다가 보내므로 입구에서 따로 기다리거나 지연 로딩을 붙이지 않습니다. 회원 정보가 필요한 화면은 `useMember`로 회원이 정해질 때까지 기다립니다.
- 오류 코드는 `isApiErrorCode(error, 'CODE')`로 확인합니다.
- 처음 여는 화면은 남겨 둘 내용이 없으므로 늦추지 않고 그 화면의 뼈대를 바로 보여 줘도 됩니다. 이때 라우트 Suspense 대체 화면과 데이터 로딩에 같은 뼈대를 써서, 뼈대에서 내용으로 한 번만 바뀌게 합니다. 뼈대는 실제 배치를 따릅니다. 지도 화면(본 방 기록 `RecordsPageSkeleton`, 동네 찾기 `NeighborhoodPageSkeleton`)은 목록 영역과 지도 영역의 배치만 `AreaSkeleton`으로 채우고 카드, 칩, 필터 모양은 그리지 않습니다. 휴대폰은 지금 보기 방식의 한 영역만, 데스크탑은 실제 화면과 같은 `ListDetailLayout`으로 두 영역을 채워 폭 규칙을 함께 씁니다.
- 서버 상태와 UI 상태를 구분합니다. 서버에서 가져온 데이터를 불필요하게 여러 컴포넌트의 로컬 상태로 복사하지 않습니다.

### 로딩 표시 기준

[SEED Loading 패턴](https://seed-design.io/patterns/loading)의 사용처 기준을 따릅니다. 글자로만 된 로딩은 두지 않고, 안내 문구는 읽기 프로그램에만 알립니다(Progress Circle의 `label`, `LoadingRegion`, `QueryState`의 `loadingTitle`).

| 상황                                   | 표시                                                                                     | 예                                                        |
| -------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 첫 진입, 페이지 전환(남은 콘텐츠 없음) | 지연 없이 화면 구조. 첫 진입은 `index.html` CSS 앱 뼈대, 그 뒤는 그 화면의 레이아웃 뼈대 | 홈 `HomePageSkeleton`, 매물 상세 `PropertyDetailSkeleton` |
| 고정 레이아웃 페이지                   | 실제 크기를 따른 스켈레톤(`PageSkeleton`)                                                | 수정, 사진, 부가 정보, 체크리스트 화면                    |
| 뼈대가 없는 페이지 전체                | 가운데에 Progress Circle 40(`PageLoading`)                                               | 방 비교, 저렴한 한 끼 패널                                |
| 남아 있는 요소 안의 부분 로딩          | 지연(300ms) 뒤 그 자리에 Progress Circle 24                                              | 사진, 메모, 체크 항목 고르기, 식당 목록, 최근 기록        |
| 콘텐츠가 있는 상태에서 다시 불러오기   | 콘텐츠 위 Overlay와 Progress Circle. 뒤를 조작할 수 있으면 작은 Overlay                  | 지도 불러오기                                             |
| 버튼 동작                              | 누르는 즉시 중복 클릭만 막고, 지연(300ms) 뒤 버튼 안 스피너                              | 공용 `Button`의 `isLoading`                               |

- 스켈레톤은 실제 크기와 같게 하고, 둥글기는 글자 줄 8px, 카드와 썸네일 16px, 원형 9999px로 둡니다(`shared/ui/skeleton/Skeleton`).
- 스켈레톤과 Progress Circle을 같이 쓰지 않습니다.
- 개수를 알 수 없고 높이가 바뀌면 아래 요소를 미는 목록에는 스켈레톤을 쓰지 않습니다. 예: 홈 최근 기록한 방

## 8. 접근성

- 이미지에는 의미에 맞는 `alt`를 작성합니다.
- 클릭 동작에는 가능한 한 `div` 대신 `button`이나 `a`를 사용합니다.
- 폼 입력에는 label을 제공합니다.
- 키보드만으로도 주요 기능을 사용할 수 있어야 합니다.
- 누른 버튼을 저장하는 동안 막을 때는 `disabled` 대신 `aria-disabled`를 걸고 핸들러에서 돌아갑니다. `disabled`가 되면 포커스가 `body`로 빠집니다.
- 입력칸처럼 포커스가 있던 요소를 닫으면 그 요소를 연 버튼으로 포커스를 돌립니다.
- 값이 바뀌어도 화면으로만 알 수 있는 숫자(평가 개수 등)는 `role="status"`로 알립니다. `2 / 3`처럼 기호로 읽히는 표기는 `sr-only` 문장("3개 중 2개 평가")을 따로 둡니다.
- 버튼에 `aria-label`을 주면 버튼 안 글자는 읽히지 않습니다. 화면에 보이는 값은 이름에도 넣습니다(`InfoValue`: "매물 이름 신림역 원룸, 수정").
- 화면마다 `shared/lib/hooks/useDocumentTitle`로 탭 제목을 "화면 | 자취선배"로 바꿉니다. 지금은 매물 상세에만 적용했습니다.
- 색상만으로 상태를 전달하지 않습니다.

## 9. 검사 명령어

```bash
npm run lint
npm run format:check
npm run test
npm run build
```

`npm run build`가 타입 검사를 포함하므로 코드를 제출하기 전에 린트, 포맷 검사, 테스트, 빌드를 모두 통과시키는 것을 기준으로 합니다. 타입 오류만 빠르게 확인할 때는 `npm run typecheck`를 직접 실행합니다.
