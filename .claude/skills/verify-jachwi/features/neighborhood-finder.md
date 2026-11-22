# 동네 찾기

출퇴근 장소와 통근 시간, 환승 조건을 정하면 갈 수 있는 행정동을 월세 시세와 함께 목록과 지도에 보여 준다. 상태: 검증됨(2026-11-22, 데스크탑 1440x900, DEMO MAP).

## Sub-features

- `finder-pick-destination` 지도를 눌러 출퇴근 장소를 고른다.
- `finder-search` 조건으로 동네를 찾는다.
- `finder-results` 결과 목록, 지도 심볼, 범례, 월세 슬라이더가 나온다.
- `finder-address-search` 주소 검색창으로 출퇴근 장소를 고른다.
- `finder-area-detail` 동네를 눌러 상세(`/explore/areas/<행정동 코드>`)를 본다.
- `finder-nearby` 주변 분석(`/explore/nearby`).

## How to get to it (user POV)

- 주소창으로 `/explore`(공개). 회원은 `/neighborhoods`도 쓰고, 옛 주소 `/explore/commute`와 `/explore/price`는 `/explore`로 넘어간다.
- 홈 하단의 `동네 찾기` 이동 버튼.
- 휴대폰에서 주소 검색은 `/search?target=neighborhoods` 화면으로 간다.

## Driving it with Chrome DevTools MCP

Preconditions: doctor가 통과한다. 새 탭이다(이전 탭은 목적지를 기억해 자동으로 검색한다).

- **열기.** `new_page http://localhost:3217/explore`. 스냅샷에 `찾은 동네` 제목과 `지도에서 목적지와 조건을 선택해 주세요.`, 비활성 `이 조건으로 동네 찾기` 버튼이 있다.
- **목적지 고르기.** `지도에서 선택` 버튼을 누르면 `지도에서 출퇴근 장소를 눌러 주세요`가 뜬다. `구역 경계 시안` 이미지를 클릭한다. `선택한 위치` 마커와 `바꾸기` 버튼이 생기고 `GET /api/maps/reverse-geocode` 200이 나간다. `이 조건으로 동네 찾기`가 활성화된다.
- **조건.** 기본은 `40분`, `1회 이하`다. 라디오 `10분`부터 `60분`, `환승 없음`, `1회 이하`, `2회 이하`로 바꾼다.
- **검색.** `이 조건으로 동네 찾기`를 누른다. 결과 `GET /api/commute-areas/with-rents?latitude=..&longitude=..&maxMinutes=40&maxTransfers=1`이 200이다. 쿼리 값이 고른 조건과 같은지 본다.
- **결과 증명.** 스냅샷을 파일로 저장해 `찾은 동네` 아래 버튼(`삼성1동 월세 85만원 2분` 형태)이 수백 개 있고, `graphics-symbol` 심볼, 범례(`15분 이하`, `16~30분`, `31~40분`, `월세 정보 없음`), `최대 월세 시세` 슬라이더, `이 동네에서 본 방 기록하기` 버튼이 있는지 `grep`한다. 스크린샷을 남긴다.
- **성능.** `navigate_page`로 `/explore`를 연 뒤 `performance_start_trace`(`reload`, `ignoreCache`). 목적지는 저장돼 새로고침해도 자동 검색까지 간다. 2026-11-22 측정(스로틀 없음, webpack dev, DEMO MAP): LCP 2463 ms(TTFB 266 ms, 렌더 지연 2197 ms), CLS 0.00.

## Gotchas

- 지도 모드가 DEMO면 경계 시안만 보인다. 실제 타일과 마커는 검증하지 못한다고 보고한다.
- 결과 스냅샷은 동네 수백 개라 파일로만 저장한다.
- 검색 결과 호출은 인증이 필요하다. `POST /api/auth/login` 뒤에 나가는지 순서를 본다.
- 새로고침하면 마지막 목적지로 바로 검색한다. "처음 상태"를 보려면 새 탭이나 `new_page`에 `isolatedContext`를 준다.
- 휴대폰 레이아웃은 다른 컴포넌트다. 데스크탑 통과가 모바일 통과가 아니다.
- 월세가 없는 동네는 `시세 없음`으로 나온다. 결함이 아니다.
- 증거 위치: `qa/runs/verify-jachwi/finder-20261122/`.
