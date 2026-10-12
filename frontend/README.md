# 자취선배 프론트엔드

- 상태: MVP2 구현 완료

React 19·TypeScript 6·Webpack 5 기반 모바일 우선 SPA입니다.

## 관련 문서

- [백엔드와 프론트엔드 로컬 개발](../backend/docs/guides/local-development.md)
- [백엔드 환경변수](../backend/docs/guides/environment-variables.md)
- [프론트엔드 배포](docs/deployment.md)
- [프론트엔드 테스트 전략](docs/testing-strategy.md)

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

기본 `.env.example`은 외부 키가 필요 없는 닉네임 인증·데모 지도 모드입니다. `.env.example`을 `.env.local`로 복사하면 Webpack이 빌드 시작에 그 값을 읽습니다(`.env.local`은 저장소에 올라가지 않으며, 이미 설정된 셸 환경변수를 덮어쓰지 않습니다). `http://localhost:3000`에서 닉네임과 선택 비밀번호로 바로 시작합니다.

`npm run dev`는 실제 백엔드 API에 연결합니다. 백엔드 없이 UI fixture만 확인할 때에만 `npm run dev:mock`을 사용합니다. dev 배포에서 fixture가 꼭 필요한 경우에는 CodePipeline 빌드 환경변수에 `ENABLE_MSW=true`를 지정할 수 있으며, 운영에서는 이 값을 사용하지 않습니다.

목(MSW)은 배포된 dev 백엔드와 같은 필드만 내려줘야 합니다. 목이 계약보다 넉넉하면 화면이 실제로는 없는 필드를 읽어도 목 뒤에서는 드러나지 않습니다. `test/app/mocks/contractShape.test.ts`가 응답별 필드 집합을 정확히 비교해 이를 막으므로, API 계약이 바뀌면 그 표를 먼저 고치고 목을 맞춥니다.

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

인스타그램 광고용 공개 페이지는 `/landing`입니다. 오리 로고, 네 장의 순환 슬라이드, App Store·웹 시작 버튼을 제공합니다. 로고는 iPhone·iPad에서는 App Store로, 그 외 환경에서는 운영 웹 로그인으로 연결됩니다. 로컬 확인 주소는 `http://localhost:3000/landing`이며, 연결 주소와 이미지는 `src/pages/landing/LandingPage.tsx`에서 관리합니다.

| 화면                 | 경로                                                      | 기능                                           |
| -------------------- | --------------------------------------------------------- | ---------------------------------------------- |
| 닉네임으로 시작      | `/login`                                                  | 닉네임과 선택 비밀번호로 시작                  |
| 공개 안내            | `/intro`, `/privacy`                                      | 서비스 소개와 광고 측정 동의·철회              |
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

- Access Token은 탭 단위 `sessionStorage`에 `expiresAt`과 함께 저장해 새로고침만 복구합니다. `localStorage`에는 쓰지 않습니다.
- 401·만료·로그아웃은 인증 Query Cache와 토큰을 함께 지웁니다.
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
