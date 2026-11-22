---
name: verify-jachwi
description: 자취선배 웹 프론트를 로컬에서 띄워 사용자처럼 구동하고 증거를 남기며, 실행되는 프론트 코드가 바뀐 PR(리팩터링 포함)의 화면 전후 판정을 한다. 갈 수 있는 화면인지 먼저 확인하고, MSW 목과 고정 응답 시간으로 기준 스크린샷과 사용자 기준 순간을 전후로 재서 verdict.md를 남긴다. 동네 찾기, 지도, 매물 상세, 체크리스트, 거리 메모 동작 증명, 화면 변경, 로딩 성능, 리팩터링 PR의 증거가 필요할 때 쓴다.
---

# verify-jachwi

자취선배 프론트를 실제로 띄워 사용자 경로로 구동하고 증거를 남기는 검증 스킬이다. 기능별 레시피는 [features/README.md](features/README.md)에서 시작한다. 운영 사이트(jachwi-sunbae.kr)는 쓰지 않는다.

## 언제 도는가와 통과 기준

- 도는 경우는 `frontend/scripts/visual-scope.mjs`가 정한다. 규칙은 그 파일 한 곳에만 있고 여기에 옮겨 적지 않는다. "UI를 바꾸려는 PR"이 아니라 "실행되는 프론트 코드가 바뀐 PR"이 대상이라 리팩터링도 들어간다.
- PR을 올리기 전에 `frontend`에서 `npm run verify:pr`(기준이 다르면 `-- --base upstream/develop`)를 돌린다. 판정이 필요한지, 볼 화면(영향 라우트), PR 본문에 붙일 `## 화면 판정` 빈 틀을 낸다. 범위 밖이면 `화면 판정 필요 없음`을 내고 여기서 끝난다.
- 판정은 올리는 쪽(사람이나 에이전트)이 로컬에서 한다. CI(`.github/workflows/visual-verdict.yml`)는 본문의 `## 화면 판정` 절에 결과, 영향 라우트, 증거 링크가 있는지만 본다. 결과가 `나빠짐`이면 실패, 제목이 `[Refactor]`인데 `같음`이 아니면 실패다.
- 판정 기준: 사용자가 기다리는 순간(첫 매물 카드, 결과 목록, 경계 표시 등)이 정한다. 지도 배경이나 LCP 같은 보조 지표만으로 판정하지 않는다. 리팩터링 PR은 `같음`이어야 통과다. `나빠짐`이거나 사용자 기준 순간이 좋아지지 않았으면 PR 본문에 "개선"이라고 쓰지 않는다.

## 녹화와 검증 전에: 갈 수 있는 화면인가

```sh
cd frontend && node scripts/reachable-routes.mjs --check /explore/nearby
```

- 녹화, 스크린샷, 성능 기록, 전후 판정을 하기 전에 대상 주소마다 돌린다. 1로 끝나면 "갈 수 없는 화면이라 증거로 쓰지 않는다"고 적고 멈춘다. 사용자가 실제로 들어오는 화면에서 다시 찍거나, 그 화면으로 오는 링크부터 만든다.
- 전체 목록은 `npm run routes:reachable`이다. 라우터 정의와 앱 안 링크(Link, navigate, 하단 탭 등)를 읽어 만든다. 밖에서만 들어오는 화면(`/explore`, `/landing` 등)은 이유와 함께 예외로 들어 있다.
- 알고 남겨 둔 갈 수 없는 라우트(`knownUnreachable`)는 줄기만 한다. 새로 생긴 갈 수 없는 라우트는 `test/scripts/reachable-routes.test.ts`가 CI에서 잡는다.

## 화면별 기준 스크린샷

MSW 목 데이터와 고정 응답 시간으로 운영 빌드를 띄워, 갈 수 있는 주요 화면마다 데스크탑(1440x900)과 휴대폰(390x844) 폭으로 찍는다. 기준 이미지는 레포에 커밋하지 않는다(`qa/runs/`는 git 제외). 찍는 방법과 비교 방법만 여기 둔다.

```sh
S=.claude/skills/verify-jachwi/scripts
$S/build-variant.sh before upstream/develop 4301      # 비교할 커밋을 따로 꺼내 운영 빌드
$S/build-variant.sh after HEAD 4302
node $S/serve.mjs --dist "${TMPDIR:-/tmp}/verify-jachwi-variants/before/frontend/dist" --port 4301 --api mock --delay 300 &
node $S/serve.mjs --dist "${TMPDIR:-/tmp}/verify-jachwi-variants/after/frontend/dist" --port 4302 --api mock --delay 300 &
node $S/baseline.mjs --base http://localhost:4301 --out qa/runs/verify-jachwi/<이름>/baseline-before
node $S/baseline.mjs --base http://localhost:4302 --out qa/runs/verify-jachwi/<이름>/baseline-after
node $S/compare.mjs qa/runs/verify-jachwi/<이름>/baseline-before qa/runs/verify-jachwi/<이름>/baseline-after qa/runs/verify-jachwi/<이름>/baseline-side
```

- `serve.mjs --api mock`은 레포의 MSW 핸들러(`frontend/src/app/mocks/handlers`)를 Node에서 돌려 모든 `/api` 응답을 `--delay` ms 뒤에 준다. 서비스 워커가 아니라 진짜 HTTP 응답이라 회선 제한이 API에도 걸리고, 전과 후가 같은 데이터를 받는다. `--api dev`는 dev API로 중계한다.
- 운영 빌드는 늘 실제 네이버 지도라 `frontend/.env.local`에 지도 키가 있어야 한다. `build-variant.sh`가 이 파일을 복사한다(커밋하지 않는다).
- 화면 목록은 `baseline.mjs`의 `SCREENS`다. 찍기 전에 `reachable-routes`로 확인해 갈 수 없는 화면은 빼고 `screens.md`에 그렇게 적는다. 판정 범위를 좁힐 때는 `--only`에 `npm run verify:pr`이 낸 라우트를 쉼표로 준다.
- 비교: `compare.mjs`가 화면마다 다른 픽셀 비율(채널 차이 24 초과)과 전, 후, 다른 픽셀을 나란히 붙인 `<화면>.side.png`를 만든다. 같은 빌드를 두 번 찍어도 지도 타일과 랜딩 영상 때문에 몇 % 다를 수 있다. 비율이 0이 아닌 화면은 `side.png`를 직접 열어 무엇이 다른지 적는다.
- 목에 핸들러가 없는 요청(예: 저렴한 한 끼의 `/api/maps/good-price-stores` 501)은 `screens.md`에 오류로 남는다. 전과 후가 같으면 판정에 쓰지 않는다.

## 전후 판정

1. 사용자가 기다리는 순간을 먼저 정한다. 홈은 첫 매물 카드(`--moment card`), 다른 화면은 결과 목록이나 경계 표시처럼 사용자가 기다리는 요소의 CSS 선택자(`--selector`)다. 지도 배경, LCP는 보조 지표다.
2. 위 `build-variant.sh`와 `serve.mjs`로 전과 후를 띄운다(전은 `upstream/develop`, 후는 PR 머리).
3. 잰다. 전후를 번갈아 각 3회 이상(기본 5회), 빈 캐시 첫 방문이다. 회선 기본은 보통 4G(`fast4g`: 지연 70ms, 내려받기 9Mbps, CPU 4배)다.

   ```sh
   node $S/measure.mjs --before http://localhost:4301 --after http://localhost:4302 \
     --path / --moment card --runs 5 --net fast4g --viewport mobile --out qa/runs/verify-jachwi/<이름>/verdict
   ```

4. `verdict.md` 초안이 나온다. 중앙값 차이와 흩어짐(전, 후 각각의 최대 - 최소 중 큰 값)을 적고, 차이가 흩어짐 이하면 `같음`이다. 순간을 못 본 회차가 후에서 늘거나 콘솔 오류, 실패한 요청(4xx, 5xx, 끊김)이 후에서 늘면 `나빠짐`이다.
5. 같은 시각 스크린샷(기본 2, 4, 6, 8초. 순간이 그 사이면 `--shots 2,3,4,6,8`)을 나란히 붙여 직접 연다. 스크린샷은 시간을 재는 회차와 따로 한 번 더 열어 찍는다.

   ```sh
   node $S/compare.mjs qa/runs/verify-jachwi/<이름>/verdict/shots/before qa/runs/verify-jachwi/<이름>/verdict/shots/after qa/runs/verify-jachwi/<이름>/verdict/side
   ```

   `side/<N>s.side.png`를 보고 `verdict.md`의 표에 시각마다 늦게 뜨는 요소를 적는다.

6. `npm run verify:pr`이 낸 `## 화면 판정` 틀에 결과, 영향 라우트, 증거 링크(verdict.md와 나란히 보기 그림)를 채워 PR 본문에 붙인다. 리팩터링 PR은 `같음`이어야 한다. `나빠짐`이거나 사용자 기준 순간이 좋아지지 않았으면 "개선"이라고 쓰지 않는다.
7. 끝나면 `serve.mjs` 프로세스를 끄고 `git worktree remove --force "${TMPDIR:-/tmp}/verify-jachwi-variants/<이름>"`로 빌드 폴더를 지운다.

드라이버는 `qa/`의 Playwright다(`cd qa && npm ci`). Playwright 브라우저가 없으면 `npx playwright install chromium`을 하거나 `CHROME_PATH`에 Chrome 경로를 준다.

## Launch

```sh
.claude/skills/verify-jachwi/scripts/launch.sh 3217
```

- 레포 루트의 `frontend`에서 `npm run dev`를 `PORT=3217`, `DEV_API_PROXY_TARGET=https://dev-api.jachwi-sunbae.kr`로 띄운다. `/api`만 dev API로 중계되고 Origin 헤더는 제거된다. 직접 부르면 dev API의 CORS에 막힌다.
- `frontend/node_modules`가 없으면 `npm ci`를 먼저 한다. Node 22.23.x가 기준이고 22.22 에서도 돌아간다(경고만).
- 준비됨은 로그의 `compiled successfully`다. 이어서 doctor가 익명 로그인까지 확인한다.
- 포트가 이미 쓰이면 스크립트가 실패한다. 3100과 3000은 다른 작업 서버가 잡고 있을 수 있으니 죽이지 말고 포트를 옮긴다. 다른 앱이 포트를 잡으면 API 호출이 HTML을 받는다.
- 네이버 지도 키(`NAVER_MAP_CLIENT_ID`)는 `frontend/.env.local`에 있다(`MAP_PROVIDER_MODE=naver`). 이 파일은 커밋하지 않는다. 키가 없으면 지도는 `DEMO MAP`(구역 경계 시안)이다. DEMO에서 검증되는 것은 흐름, 목록, 네트워크 호출이고, 실제 지도 타일과 마커 모양은 키가 있어야 본다. 스냅샷에 `NAVER` 링크가 보이면 실제 지도다. 실제 지도에는 `구역 경계 시안` 같은 클릭 대상이 없어 주소 검색이나 좌표 클릭([지도](features/map.md))으로 조작한다.
- 상태 폴더 `${TMPDIR:-/tmp}/verify-jachwi-<포트>/`에 pid와 `dev.log`를 둔다.

## Auth

`/login`은 없다(`/`로 리다이렉트). 앱은 처음 열면 `POST /api/auth/login`으로 익명 회원을 자동 생성한다. 브라우저 컨텍스트마다 새 익명 회원이고, 새 회원에게는 샘플 매물 `(미리보기) 코엑스 근처`(`/properties/-1`)가 보인다. 기존 qa 픽스처(`qa/src/member.ts`의 `/login` 닉네임 폼)는 깨져 있으니 쓰지 않는다. 동네 찾기(`/explore`)는 공개 화면이지만 접속하면 같은 익명 로그인이 일어난다. 이 검증은 dev DB에 익명 회원을 만든다. 매물과 메모를 저장하는 레시피는 그 회원 안에서만 쓴다.

## Doctor

```sh
.claude/skills/verify-jachwi/scripts/doctor.sh 3217
```

읽기 전용. 우리가 띄운 프로세스인지, 프론트 200, dev API 커밋, 프록시 경유 익명 로그인 200을 본다. 하나라도 FAIL이면 구동하지 말고 원인부터 고친다.

## Drive

기본 드라이버는 Chrome DevTools MCP(`chrome-devtools`, headless Chrome for Testing, 1440x900)다.

1. `new_page`로 `http://localhost:3217/<경로>`를 연다. 이 MCP는 탭을 계속 쓰니 `list_pages`로 pageId를 확인한다.
2. `take_snapshot`으로 uid를 얻고 `click`, `fill`, `wait_for`로 조작한다. uid는 스냅샷마다 바뀌니 직전 스냅샷만 쓴다.
3. `isolatedContext`를 주면 새 익명 회원이다. 기능마다 컨텍스트 이름을 다르게 준다. 동네 찾기 스냅샷은 동네 수백 개를 나열한다. 결과 화면 스냅샷은 반드시 `filePath`로 파일에 저장하고 `grep`으로 본다. 그냥 받으면 컨텍스트를 채운다.
4. 안내 다이얼로그가 뜨면 `확인` 버튼을 먼저 누른다(첫 방문 가이드).
5. 지도 빈 곳 클릭은 MCP `click`이 못 한다. `evaluate_script`로 좌표의 요소에 포인터와 마우스 이벤트를 디스패치한다(스니펫은 [지도](features/map.md)).
6. 휴대폰 화면은 `resize_page`나 `emulate`로 맞춘다. 데스크탑과 휴대폰은 다른 컴포넌트(`desktop/`, `mobile/`)다.
7. 선택자는 ARIA 이름이 기준이다(`이 조건으로 동네 찾기`, `지도 확대`, `메모 남기기`). 좌표와 탭 순서는 쓰지 않는다.

기존 Playwright 스모크(`qa/tests/finder-map-smoke.spec.ts`는 `refactor/remove-ai-slop-finder-map` 브랜치에 있다)는 같은 경로를 Pixel 7 모바일로 돌린다. `qa/`의 Playwright는 `QA_BASE_URL=http://localhost:3217`로 로컬에 붙일 수 있다(운영 도메인은 설정이 막는다). 회원 픽스처 없이 `page.goto('/explore')`로 시작한다.

## Evidence

저장 위치: `qa/runs/verify-jachwi/<기능>-<날짜>/` (`qa/runs/`는 git 제외이고 cleanup이 지우지 않는다).

```
evidence/NN-<단계>.png          take_screenshot filePath
evidence/NN-<단계>.aria.txt     take_snapshot filePath
evidence/<요청>.network-response get_network_request responseFilePath
evidence/network.txt            list_network_requests 결과(fetch, xhr, document)를 옮겨 적은 것
perf/<화면>-load.trace.json.gz  performance_start_trace filePath
result.md                       경로, 판정, 부수효과, 조건이 붙은 숫자
```

증명 기준:

- 실제 사용자 경로로 한다. 내부 setter나 테스트 전용 엔드포인트를 쓰지 않는다. 행동 직전 상태, 행동, 결과 상태를 모두 남긴다.
- 화면에 보이는 것과 함께 부수효과를 본다. 동네 찾기는 `GET /api/commute-areas/with-rents` 200과 쿼리 값, 매물 저장은 저장 뒤 새로고침해서 다시 보이는지.
- 로딩 성능은 DevTools 트레이스와 네트워크 기록으로 남긴다. 조건을 숫자와 함께 적는다: 화면, 캐시 무시 여부, 스로틀(`CPU throttling`, `Network throttling`), 빌드(webpack dev는 비압축이라 운영보다 느리다), 지도 모드(DEMO). 순서: `navigate_page`로 대상 주소를 연다, `performance_start_trace`(`reload: true`, `ignoreCache: true`, `filePath`), 요약의 LCP, TTFB, 렌더 지연, CLS를 `result.md`에 표로 적는다. 더 파려면 `performance_analyze_insight`. 전후 비교는 같은 조건으로 두 번 돌려 한 표에 둔다.
- 네트워크 헤더에는 Bearer 토큰이 들어 있다. `get_network_request`의 헤더 출력을 증거 파일이나 PR 본문에 옮기지 않는다(본문 파일만 저장).
- 화면 변경 PR이면 전후 GIF를 남긴다. 만드는 도구와 올리는 곳은 각자 환경에 둔다(이 스킬에 넣지 않는다).

## 다른 기기에서 돌리기

- Node 22.x로 `frontend`, `qa`에서 `npm ci`를 한다.
- `frontend/.env.local`에 `MAP_PROVIDER_MODE=naver`와 네이버 키(`NAVER_MAP_CLIENT_ID`, `NAVER_SEARCH_CLIENT_ID`)가 있어야 실제 지도가 나온다. 키의 허용 도메인에 `http://localhost:<포트>`가 있어야 한다. 이 파일은 커밋하지 않는다.
- 스크립트는 `ss`가 없으면 `lsof`, `setsid`가 없으면 `nohup`을 쓴다(macOS).
- 스냅샷 uid와 HTML 구조는 기기가 달라도 같지만 글꼴 때문에 스크린샷 픽셀은 다르다. 기준 스크린샷은 같은 기기에서 찍은 것끼리만 견준다.

## Cleanup

```sh
.claude/skills/verify-jachwi/scripts/cleanup.sh 3217
```

launch가 띄운 프로세스만 종료하고 상태 폴더를 지운다. 이름으로 죽이지 않는다. MCP로 연 탭은 `close_page`로 닫는다. 증거는 지우지 않는다. 실패한 시도 뒤에도 실행한다.

## Helpers

| 스크립트                    | 호출                                                                | 하는 일                                               |
| --------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------- |
| `scripts/launch.sh [포트]`  | `.claude/skills/verify-jachwi/scripts/launch.sh 3217`               | 프론트를 dev API에 붙여 띄우고 준비될 때까지 기다린다 |
| `scripts/doctor.sh [포트]`  | 위와 같은 경로                                                      | 읽기 전용 점검                                        |
| `scripts/cleanup.sh [포트]` | 위와 같은 경로                                                      | 우리가 띄운 서버만 종료                               |
| `scripts/build-variant.sh`  | `build-variant.sh <이름> <ref> <포트>`                              | 비교할 커밋을 따로 꺼내 운영 빌드                     |
| `scripts/serve.mjs`         | `node serve.mjs --dist <dist> --port <포트> --api mock --delay 300` | 빌드를 내보내고 `/api`를 목(고정 지연)이나 dev로 답함 |
| `scripts/baseline.mjs`      | `node baseline.mjs --base <주소> --out <폴더>`                      | 주요 화면 기준 스크린샷(데스크탑, 휴대폰)             |
| `scripts/compare.mjs`       | `node compare.mjs <전> <후> <출력>`                                 | 다른 픽셀 비율과 나란히 보기 그림                     |
| `scripts/measure.mjs`       | `node measure.mjs --before <주소> --after <주소> ...`               | 사용자 순간을 전후로 재고 verdict.md 초안             |
| `scripts/verdict.mjs`       | `node verdict.mjs <runs.jsonl>`                                     | 판정 다시 계산                                        |

## 유지

앱이 바뀌면 `/pstack:maintain-verification-skill`로 `features/`를 맞춘다. 각 기능 파일의 상태 줄(`검증됨` 또는 `초안`)을 고치는 것이 그 일의 일부다.
