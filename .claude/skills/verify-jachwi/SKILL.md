---
name: verify-jachwi
description: 자취선배 웹 프론트(React, webpack dev)를 로컬에서 dev API에 붙여 띄우고 Chrome DevTools MCP로 사용자처럼 구동해 증거(스크린샷, ARIA 스냅샷, 네트워크, 성능 트레이스)를 남긴다. 동네 찾기, 지도, 매물 상세, 체크리스트, 거리 메모가 동작하는지 증명하거나 화면 변경과 로딩 성능 PR의 증거가 필요할 때 쓴다.
---

# verify-jachwi

자취선배 프론트를 실제로 띄워 사용자 경로로 구동하고 증거를 남기는 검증 스킬이다. 기능별 레시피는 [features/README.md](features/README.md)에서 시작한다. 운영 사이트(jachwi-sunbae.kr)는 쓰지 않는다.

## Launch

```sh
.claude/skills/verify-jachwi/scripts/launch.sh 3217
```

- 레포 루트의 `frontend`에서 `npm run dev`를 `PORT=3217`, `DEV_API_PROXY_TARGET=https://dev-api.jachwi-sunbae.kr`로 띄운다. `/api`만 dev API로 중계되고 Origin 헤더는 제거된다. 직접 부르면 dev API의 CORS에 막힌다.
- `frontend/node_modules`가 없으면 `npm ci`를 먼저 한다. Node 22.23.x가 기준이고 22.22 에서도 돌아간다(경고만).
- 준비됨은 로그의 `compiled successfully`다. 이어서 doctor가 익명 로그인까지 확인한다.
- 포트가 이미 쓰이면 스크립트가 실패한다. 3100과 3000은 다른 작업 서버가 잡고 있을 수 있으니 죽이지 말고 포트를 옮긴다. 다른 앱이 포트를 잡으면 API 호출이 HTML을 받는다.
- 네이버 지도 키(`NAVER_MAP_CLIENT_ID`)가 없으면 지도는 `DEMO MAP`(구역 경계 시안)이다. 이 모드로 충분히 검증되는 것은 흐름, 목록, 네트워크 호출이다. 실제 지도 타일과 마커 모양은 키가 있는 `.env.local`에서만 본다.
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
3. 동네 찾기 스냅샷은 동네 수백 개를 나열한다. 결과 화면 스냅샷은 반드시 `filePath`로 파일에 저장하고 `grep`으로 본다. 그냥 받으면 컨텍스트를 채운다.
4. 안내 다이얼로그가 뜨면 `확인` 버튼을 먼저 누른다(첫 방문 가이드).
5. 휴대폰 화면은 `resize_page`나 `emulate`로 맞춘다. 데스크탑과 휴대폰은 다른 컴포넌트(`desktop/`, `mobile/`)다.
6. 선택자는 ARIA 이름이 기준이다(`이 조건으로 동네 찾기`, `지도 확대`, `체크 항목 카테고리`). 좌표와 탭 순서는 쓰지 않는다.

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
- 화면 변경 PR이면 전후 GIF를 `~/.claude/skills/pr-media`로 만든다.

## Cleanup

```sh
.claude/skills/verify-jachwi/scripts/cleanup.sh 3217
```

launch가 띄운 프로세스만 종료하고 상태 폴더를 지운다. 이름으로 죽이지 않는다. MCP로 연 탭은 `close_page`로 닫는다. 증거는 지우지 않는다. 실패한 시도 뒤에도 실행한다.

## Helpers

| 스크립트                    | 호출                                                  | 하는 일                                               |
| --------------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| `scripts/launch.sh [포트]`  | `.claude/skills/verify-jachwi/scripts/launch.sh 3217` | 프론트를 dev API에 붙여 띄우고 준비될 때까지 기다린다 |
| `scripts/doctor.sh [포트]`  | 위와 같은 경로                                        | 읽기 전용 점검                                        |
| `scripts/cleanup.sh [포트]` | 위와 같은 경로                                        | 우리가 띄운 서버만 종료                               |

## 유지

앱이 바뀌면 `/pstack:maintain-verification-skill`로 `features/`를 맞춘다. 각 기능 파일의 상태 줄(`검증됨` 또는 `초안`)을 고치는 것이 그 일의 일부다.
