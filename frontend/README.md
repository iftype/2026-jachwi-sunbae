# 자취선배 프론트엔드

- 상태: MVP2 구현 완료

React 19·TypeScript 6·Webpack 5 기반 모바일 우선 SPA입니다.

## 관련 문서

체크리스트 집계 막대와 범례는 괜찮음=초록, 주의=빨강, 미확인=회색을 사용합니다. 동네 찾기 통근 범례도 홈 집계처럼 짧은 세로 색상 막대와 텍스트로 표시하며, 통근 구간의 파랑·초록·빨강 의미는 유지합니다.

페이지 전환의 화면 파일 로딩은 공용 `ProgressCircle`(40px)로 표시합니다. 홈(`/properties`)은 사진·텍스트 형태의 매물 스켈레톤을 사용하며 목록 데이터 로딩에도 같은 스켈레톤을 재사용합니다. 실제 진행률을 알 수 없어 원형 로딩은 불확정 회전으로 표시합니다. `LazyRouteBoundary`의 fallback만 변경하면 기존 안내 UI로 되돌릴 수 있으며 오류·재시도 화면은 유지합니다.

- [백엔드와 프론트엔드 로컬 개발](../backend/docs/guides/local-development.md)
- [백엔드 환경변수](../backend/docs/guides/environment-variables.md)
- [프론트엔드 배포](docs/deployment.md)
- [프론트엔드 테스트 전략](docs/testing-strategy.md)
- [뮤테이션 테스트](docs/mutation-testing.md)

## 설치와 실행

Node.js는 [`.nvmrc`](./.nvmrc)의 `22.23.1`을 사용합니다.

```bash
nvm use
npm ci
cp .env.example .env.local
set -a
source .env.local
set +a
npm run dev
```

기본 `.env.example`은 외부 키가 필요 없는 익명 자동 로그인·데모 지도 모드입니다. `.env.example`을 `.env.local`로 복사하면 Webpack이 빌드 시작에 그 값을 읽습니다(`.env.local`은 저장소에 올라가지 않으며, 이미 설정된 셸 환경변수를 덮어쓰지 않습니다). `http://localhost:3000`에 들어가면 로그인 입력 없이 자동으로 익명 회원으로 시작합니다.

`npm run dev`는 실제 백엔드 API에 연결합니다. 백엔드 없이 UI fixture만 확인할 때에만 `npm run dev:mock`을 사용합니다. dev 배포에서 fixture가 꼭 필요한 경우에는 CodePipeline 빌드 환경변수에 `ENABLE_MSW=true`를 지정할 수 있으며, 운영에서는 이 값을 사용하지 않습니다.

목(MSW)은 배포된 dev 백엔드와 같은 필드만 내려줘야 합니다. 목이 계약보다 넉넉하면 화면이 실제로는 없는 필드를 읽어도 목 뒤에서는 드러나지 않습니다. `test/app/mocks/contractShape.test.ts`가 응답별 필드 집합을 정확히 비교해 이를 막으므로, API 계약이 바뀌면 그 표를 먼저 고치고 목을 맞춥니다.

## 지도 주변 시설 조회

지도 교통 필터는 `GET /api/maps/bus-stops`로 버스정류장을 조회합니다(500m·1km·2km). `nodeId`를 마커 ID로 사용하며 반경 안의 전체 정류장을 표시합니다. 병원·학교·편의점·중개업소는 기존 `nearby`를 사용하고 요청·집계에 `TRANSPORT`를 넣지 않습니다. 지도 탭과 매물 주변 분석에서 같은 조회 Hook을 재사용하며 교통만 선택하면 nearby를 추가로 요청하지 않습니다.

## 공개 빌드 설정

### dev API 연동 확인

로컬에서 dev 백엔드를 사용할 때는 `.env.local`에 아래 값을 설정하고 개발 서버를 다시 실행합니다.

```dotenv
API_BASE_URL=https://dev-api.jachwi-sunbae.kr
DEV_API_PROXY_TARGET=https://dev-api.jachwi-sunbae.kr
ENABLE_MSW=false
```

dev API는 localhost Origin을 허용하지 않으므로 로컬에서는 `http://localhost:3000/api`를 개발 서버가 dev API로 중계합니다. 중계 시 브라우저의 Origin 헤더만 제거하고 인증 헤더는 유지합니다. 개발 서버 프록시는 `/api`에만 적용하고 TLS 인증서 검증은 유지합니다. `DEV_API_PROXY_TARGET`은 배포 빌드에서 무시됩니다. 배포에서는 `API_BASE_URL`과 `ENABLE_MSW=false`로 재빌드해 서버를 직접 호출합니다. `npm run dev:mock`은 프록시 없이 테스트 데이터를 사용합니다.

프록시를 쓰면 API 주소가 개발 서버 자신이 되므로, 3000번을 다른 프로그램이 쓰고 있으면 개발 서버가 뜨지 않습니다(`EADDRINUSE`). 이때는 `PORT=3001 npm run dev`처럼 포트를 옮기면 프록시 주소도 함께 따라갑니다. 포트를 옮기지 않은 채 다른 앱이 3000번을 잡고 있으면 API 호출이 그 앱의 HTML을 받아 "요청을 처리하지 못했습니다"로 끝나므로, 먼저 `lsof -i :3000`으로 누가 쓰고 있는지 확인합니다.

API 변경 작업 전에는 [실행 리비전](https://dev-api.jachwi-sunbae.kr/actuator/info)과 [배포된 Swagger](https://dev-api.jachwi-sunbae.kr/v3/api-docs)를 함께 확인합니다. Git 커밋 날짜만으로 배포 여부를 판단하지 않습니다.

- 부가정보는 `GET /api/properties/{id}`로 조회하고 `PUT /api/properties/{id}`로 저장합니다. 전체 교체이므로 기본정보 수정 시에도 기존 입주일·관리비·방문일정·방 옵션·공과금을 보존합니다.
- `/api/properties/{id}/memo`는 하나의 자유 메모를 GET으로 조회하고 PUT으로 교체하거나 생성합니다.
- 매물 주소는 `address`로 전송합니다. 지도 검색 API의 `roadAddress`·`jibunAddress`와 구분합니다.
- 체크리스트 단계는 `ON_SITE`와 `PRE_CONTRACT`이며, 매물 생성 시 서버가 자동 적용하므로 생성 직후 재적용하지 않습니다.

### 환경변수

| 환경변수              | 데모 기본               | 설명                               |
| --------------------- | ----------------------- | ---------------------------------- |
| `API_BASE_URL`        | `http://localhost:8080` | 백엔드 기준 URL                    |
| `MAP_PROVIDER_MODE`   | 키가 있으면 `naver`     | `demo` 또는 `naver`                |
| `NAVER_MAP_CLIENT_ID` | 비움                    | `naver` 모드의 공개 Maps Client ID |
| `ENABLE_MSW`          | `false`                 | dev fixture가 필요할 때만 `true`   |

JWT secret, 지도 Client Secret, S3 자격증명은 프론트에 넣지 않습니다. PostHog는 공개 토큰과 호스트가 설정된 dev/prod 번들에서 초기화하며, 비로그인 방문도 수집합니다. 코드 구조와 이벤트 추가 기준은 [분석 수집 문서](docs/analytics.md), 방문자·리텐션·사용성의 정의와 확인 순서는 [지표 기준](docs/analytics-goals.md)을 참고합니다.

## 화면과 경로

### 동네 추천 로컬 시안

머지된 생활권 탐색·코드 응답·상세 경로 API 계약과 실제 서버/MSW 전환 방법은 [생활권 탐색 MSW 안내](docs/commute-area-mocks.md)를 참고합니다. 행정동 경계의 시도별 분할·줌별 단순화·나눠 그리기 정책은 [통근 지도 행정동 경계](docs/commute-boundaries.md)를 참고합니다.

`npm run dev:mock` 실행 후 `/neighborhoods`에서 탐색 기준을 선택합니다. 검색은 판교 샘플만 제공하며 지도에서 직접 위치를 고를 수도 있습니다.

위치와 최대 통근 시간(기본 40분), 최대 환승 횟수(기본 1회)를 확정하면 `GET /api/commute-areas`를 호출합니다. 로딩·오류·재시도·빈 결과를 처리하며, 응답 코드에 맞는 CDN 경계·동 이름을 결합해 지도에 표시합니다. 통근 시간 상위 5개 동네를 하단 가로 카드로 비교합니다. 월세 모드는 서울·경기 법정동 경계와 최근 월세 거래를 조회하여 주변 최대 5개 동네의 단순 평균을 표시합니다. 월세 화면 디자인은 후속 개선 대상입니다.

통근 지도는 경계와 하단 카드로 동네를 선택하고 선택한 동네만 작은 정보 버튼을 표시합니다. 대중교통 정보 보기에서 별도 상세 페이지로 이동하며 왼쪽 위 X로 지도에 돌아옵니다. 월세 지도는 각 동네의 평균가를 표시하고 선택하면 별도 거래 상세 페이지로 이동합니다. 정류장은 작은 배지로 고릅니다. 가장 빠른 정류장의 `GET /api/commute-areas/route`를 조회하며, 다른 정류장을 고르면 해당 정보로 전환합니다. 버스·지하철·도보 구간, 환승 횟수와 경유 정류장을 안내하며 실시간 도착 정보나 안내 시작 기능은 제공하지 않습니다. 상세에서 돌아오면 지도 결과와 시점을 유지합니다. 새로고침·URL 직접 진입 시 검색 상태 복원은 지원하지 않습니다. GeoJSON Polygon·MultiPolygon의 분리된 면·내부 링을 보존하며 [경도, 위도]를 지도 좌표로 변환합니다.

위치 권한이 이미 허용되어 있으면 첫 지도에 현재 위치 마커를 표시합니다. 현재 위치 아이콘을 누르면 현재 위치를 선택하고 확대합니다. 동네 찾기·월세 조회에서 다른 위치를 직접 찍거나 주소로 선택하면 파란 현재 위치 점을 지우고 선택한 위치 마커만 남깁니다. 현재 위치를 다시 누르면 파란 점도 다시 표시합니다. 첫 안내는 아래에서 올라오는 토스트로 표시합니다. 지도에서 위치를 고르면 해당 위치로 확대하며 마커 옆의 선택한 조건으로 찾기로 조회합니다. 통근·환승·월세 평균가 조건은 검색창 아래 뱃지로 공용 고정 높이 시트를 열어 설정합니다. 통근은 10~~60분의 10분 단위, 환승은 0~~2회로 고르며 적용할 때만 반영합니다. 시트를 닫아도 선택 위치는 유지합니다.

`USE_REAL_COMMUTE_API=true npm run dev:mock`으로 통근·경로·월세 API를 실제 서버로 전환합니다. 통근은 로그인 없이 조회하며 행정동은 SGIS 8자리 코드를 사용합니다. 월세 API는 인증과 10자리 법정동 코드가 필요합니다. 실제 월세 조회는 `npm run dev`에서 정상 로그인 후 확인합니다. MSW 시간·정류장·상세 경로·월세 금액은 가상 데이터이고, 경계와 동 이름은 제공받은 원본을 사용합니다. 실제 서버 모드에서 실패하면 샘플로 대체하지 않습니다.

동네 찾기의 위치 선택·결과 지도에는 발행된 네이버 사용자 스타일 `631c1c09-380e-427f-b7d8-e600956dac10`을 적용합니다. 기존 지도 탭은 기본 스타일을 유지하며, 추천 경계 강조는 배경 지도 스타일과 별도로 표시합니다.

랜딩(`/landing`)은 없앴습니다. 첫 진입은 바로 홈(`/`)이며 자동 로그인합니다. 서비스 소개는 사용 방법(`/guide`, `src/pages/usage-guide`)이 맡고, 예전 `/landing`은 쿼리를 유지한 채 `/`로, `/about`은 `/guide`로 이동합니다.

| 화면                 | 경로                                                      | 기능                                           |
| -------------------- | --------------------------------------------------------- | ---------------------------------------------- |
| 공개 안내            | `/privacy`                                                | 광고 측정 동의·철회                            |
| 매물 목록            | `/properties`                                             | 매물 목록, 단계별 진행 현황, PDF 비교 진입     |
| 매물 비교            | `/compare`                                                | 2~5개 매물 선택과 전체 기록 PDF 다운로드       |
| 매물 등록            | `/properties/new`                                         | 이름·보증금·월세 입력 후 지도에서 주소 확정    |
| 매물 상세            | `/properties/:propertyId`                                 | 기본·부가 정보 즉시 수정, 사진·메모·체크 요약  |
| 매물 사진            | `/properties/:propertyId/photos`                          | 업로드·대표 지정·삭제                          |
| 매물 메모            | `/properties/:propertyId/memo`                            | 자유 메모 저장                                 |
| 매물 정보 수정       | `/properties/:propertyId/edit`                            | 위치가 없는 매물의 주소·좌표 보정              |
| 적용 체크리스트 선택 | `/properties/:propertyId/active-checklists/:stage`        | 기본 또는 내 체크리스트 적용·교체              |
| 매물 체크 진행       | `/properties/:propertyId/checklists/:propertyChecklistId` | 상태 즉시 저장·항목 메모 저장·진행 집계        |
| 내 체크리스트 목록   | `/checklists`                                             | 단계별 내 체크리스트 목록                      |
| 체크리스트 상세·수정 | `/checklists/:checklistId`                                | 체크리스트 상세·수정                           |
| 체크리스트 생성      | `/checklists/new`                                         | 기본·선택 항목 조합 생성                       |
| 마이페이지           | `/me`                                                     | 계정·모드·주요 기능 이동·로그아웃              |
| 지도                 | `/map`                                                    | 현재 위치·주소 검색·매물 핀 표시               |
| 지도에서 위치 선택   | `/map/select-location`                                    | 현재 위치·접힌 주소 검색·역지오코딩            |
| 매물 주변 분석       | `/properties/:propertyId/nearby`                          | 반경별 시설 개수·선택 시설 핀 상세·스크롤 목록 |

하단 메뉴는 홈·체크리스트·지도·마이를 제공합니다. 모든 보호 화면은 조회 중·저장 중·빈 결과·오류·재시도 상태를 제공하고 키보드 포커스와 명시적 label을 유지합니다.

## 상태와 보안

개인정보처리방침(`/privacy`)의 상단 뒤로 가기는 고정 경로 대신 진입 전 화면의 히스토리로 돌아갑니다.
로그인 화면의 쿼리와 마이페이지의 해시도 유지합니다. 직접 접속해 앱 내 이전 이력이 없으면 `/`로 교체하여
로그인 상태에 따른 기본 진입 화면으로 이동합니다.

- Access Token은 메모리에만 둡니다. 앱을 열면 `POST /api/auth/login`이 HttpOnly Refresh 쿠키로 같은 익명 회원을 복원하거나 새 익명 회원을 만듭니다.
- Access Token이 만료되거나 업무 API가 401을 주면 `POST /api/auth/refresh`로 갱신해 원래 요청을 한 번 다시 보냅니다. 갱신이 `401 REFRESH_TOKEN_INVALID`로 거절되면 새 회원을 만들지 않고 인증 Query Cache와 토큰을 지운 뒤 안내합니다.
- 사진 콘텐츠는 URL을 `<img>`에 직접 주지 않고 Bearer 인증 Blob으로 조회해 Object URL을 만든 뒤 해제합니다.
- 사진은 JPEG·PNG·WebP, 파일당 5MiB, 매물당 30장으로 선택 단계부터 검증합니다.
- 서버 상태는 TanStack Query가 관리하고, 체크 항목 상태와 메모 저장 채널은 서로 독립적입니다.
- PostHog는 dev/prod에서 서비스 경로, 기능 이벤트, 오류와 세션 리플레이를 수집하고 `environment` 속성으로 구분합니다. 세션 리플레이에서는 텍스트와 요소 속성을 마스킹합니다.

## 검사

```bash
npm run lint
npm run format:check
npm test
npm run build
```

공통 컴포넌트의 상태와 반응형 스타일은 Storybook에서 격리해 확인합니다.

```bash
npm run storybook
npm run storybook:build
```

`develop`에 반영된 Storybook은 GitHub Pages에서 팀 공용으로 확인할 수 있습니다.

- [Storybook 미리보기](https://woowacourse-teams.github.io/2026-jachwi-sunbae/)
- `.github/workflows/storybook-pages.yml`이 `develop` push마다 정적 Storybook을 빌드하고 배포합니다.

Storybook에서는 구현 내부가 아니라 기본·로딩·에러·빈 상태처럼 사용자가 보는 상태를 확인합니다. 지도 SDK처럼 외부 환경에 의존하는 화면은 Storybook 대상에서 제외하고 별도 통합·E2E 테스트로 다룹니다.

`npm run build`는 번들 생성 전에 `npm run typecheck`를 실행합니다. 개발 중 타입 오류만 빠르게 확인하려면 `npm run typecheck`를 직접 실행합니다.

실제 모바일 브라우저 확인은 운영 엔트리포인트를 `390x844`와 일반 모바일 폭에서 실행해 위 표의 경로와 주요 CRUD·체크·지도 흐름을 확인합니다.
