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

공유 기능 컴포넌트는 `features/map/ui/map-canvas/MapCanvas.tsx`, 페이지 전용 컴포넌트는 `pages/map/ui/map-property-sheet/MapPropertySheet.tsx`, 공용 UI는 `shared/ui/button/Button.tsx`처럼 둡니다. 컴포넌트 폴더에는 TSX와 CSS Module을 함께 둡니다.

`public`은 `/logo.svg`처럼 URL로 직접 제공하는 파일이고, `shared/assets`는 코드에서 import하여 Webpack이 처리하는 이미지·폰트입니다.

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
- 다른 slice나 레이어는 `@/` 별칭(`src/`)으로, 같은 slice 안은 상대 경로로 가져옵니다. 예: `pages/map`에서 `@/features/map/...`, `./hooks/useMapFilters`
- import 순서는 `simple-import-sort`가 정리합니다. 외부 패키지 → `@/app`·`@/pages`·`@/features`·`@/shared` → 상대 경로 → CSS 순서이며 `npm run lint:fix`로 맞춥니다.

```tsx
import { useState } from 'react';

import type { MapAddress } from '@/features/map/model/Map';
import TopNavigation from '@/shared/ui/top-navigation/TopNavigation';

import useMapFilters from './hooks/useMapFilters';

import styles from './MapPage.module.css';
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

- `any`는 사용하지 않고, 외부에서 알 수 없는 값은 `unknown`으로 받습니다.
- API 응답은 DTO 타입으로 받고, 화면에서 사용하는 타입과 필요하면 변환합니다.
- 타입 단언(`as`)과 non-null assertion(`!`)은 근거가 있을 때만 사용합니다.
- 타입은 사용하는 범위와 같은 슬라이스의 `model`에 둡니다. 도메인과 무관한 설정 타입만 `shared`에 둡니다.
- 타입 검사와 Babel 변환을 구분합니다. Babel은 타입을 검사하지 않으므로 `npm run build`가 번들 생성 전에 `npm run typecheck`를 실행합니다. 개발 중 타입 오류만 빠르게 확인할 때는 `npm run typecheck`를 직접 실행합니다.

## 6. CSS

- 새로 작성하거나 수정하는 화면·컴포넌트의 종속 스타일은 같은 위치의 `*.module.css`에 두고 CSS Modules로 가져옵니다.
- CSS Modules의 클래스 이름은 TypeScript에서 바로 읽을 수 있도록 `camelCase`를 사용합니다.
- 페이지 컴포넌트는 데이터와 하위 화면을 조합하고, 독립된 화면 영역은 기능 컴포넌트와 해당 CSS Module로 분리합니다.
- 페이지 CSS가 250줄을 넘거나 서로 독립적으로 설명할 수 있는 화면 영역이 둘 이상 섞이면 컴포넌트 분리를 검토합니다. 줄 수 자체보다 책임의 개수를 우선 판단합니다.
- 디자인 토큰은 `src/app/styles/tokens.css`, 요소 기본값은 `src/app/styles/global.css`, 여러 화면에서 재사용하는 유틸리티 클래스는 `src/app/styles/utilities.css`에 둡니다.
- 전역 클래스는 실제로 여러 화면에서 같은 의미와 형태로 재사용할 때만 추가합니다.
- 스타일 목적으로 ID 선택자를 사용하지 않습니다.
- 컴포넌트 스타일은 해당 컴포넌트와 가까운 위치에 둡니다.
- 페이지 전용 UI를 분리할 때 전용 CSS Module도 함께 옮깁니다. 하위 UI에서 상위 페이지 CSS Module을 가져오지 않고, 페이지에는 영역 배치와 간격을 담당하는 스타일을 남깁니다.
- `rem`: 폰트 크기와 주요 간격
- `px`: 테두리처럼 고정되어야 하는 얇은 선
- `%`, `vw`, `vh`: 부모나 화면 크기에 반응해야 하는 영역
- 색상·간격·radius처럼 반복되는 값은 CSS 변수로 관리합니다.

```css
:root {
  --color-primary: #2563eb;
  --space-md: 1rem;
  --radius-md: 0.5rem;
}
```

```tsx
import styles from './PostCard.module.css';

const PostCard = () => <article className={styles.card}>...</article>;
```

## 7. API와 상태 처리

- API 통신 코드와 DTO는 소유 기능의 `features/<feature>/api`에 둡니다.
- `apiBaseUrl` 같은 공개 설정은 props로 넘기지 않고 `usePublicConfig()`로 읽습니다. Query Hook은 내부에서 읽고, API 함수(`fetch*`, `get*QueryOptions`)는 순수 함수로 두어 `config`를 인자로 받습니다. 테스트는 `PublicConfigProvider`로 감쌉니다.
- 서버 응답 형식과 화면 모델이 다르면 API 경계에서 변환합니다.
- 조회·변경 Query Hook도 같은 기능의 `api`에 둡니다.
- 화면에는 최소한 loading, error, empty, success 상태를 고려합니다.
- 페이지 전체를 조회 결과로 그릴 때는 `shared/ui/query-state/QueryState`로 로딩·오류 화면을 맡깁니다. 오류 안내는 `describePropertyLoadError`, `describeChecklistLoadError`처럼 소유 기능의 `api`에서 만듭니다.
- 오류 코드는 `isApiErrorCode(error, 'CODE')`로 확인합니다.
- 서버 상태와 UI 상태를 구분합니다. 서버에서 가져온 데이터를 불필요하게 여러 컴포넌트의 로컬 상태로 복사하지 않습니다.

## 8. 접근성

- 이미지에는 의미에 맞는 `alt`를 작성합니다.
- 클릭 동작에는 가능한 한 `div` 대신 `button`이나 `a`를 사용합니다.
- 폼 입력에는 label을 제공합니다.
- 키보드만으로도 주요 기능을 사용할 수 있어야 합니다.
- 색상만으로 상태를 전달하지 않습니다.

## 9. 검사 명령어

```bash
npm run lint
npm run format:check
npm run test
npm run build
```

`npm run build`가 타입 검사를 포함하므로 코드를 제출하기 전에 린트, 포맷 검사, 테스트, 빌드를 모두 통과시키는 것을 기준으로 합니다. 타입 오류만 빠르게 확인할 때는 `npm run typecheck`를 직접 실행합니다.
