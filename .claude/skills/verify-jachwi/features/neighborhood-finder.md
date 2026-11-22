# 동네 찾기

출퇴근 장소와 통근 시간, 환승 조건을 정하면 갈 수 있는 행정동을 월세 시세와 함께 목록과 지도에 보여 준다. 상태: 검증됨(2026-11-22, 데스크탑 1440x900, 실제 네이버 지도와 DEMO MAP 둘 다).

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

- **열기.** `new_page http://localhost:3217/explore`(`isolatedContext` 지정). 첫 방문이면 지도 안에 안내 `지도를 눌러 출퇴근 장소를 골라요`와 `확인`이 있어 먼저 누른다. 스냅샷에 `찾은 동네` 제목, `지도에서 목적지와 조건을 선택해 주세요.`, 비활성 `이 조건으로 동네 찾기` 버튼이 있다.
- **목적지 고르기, 실제 지도(권장).** `출퇴근 장소` 텍스트박스에 `판교역`을 `fill`한다. `검색` 버튼을 누르지 않아도 제안 버튼(`경기도 성남시 분당구 판교역로 160 ...`)이 뜬다. 첫 제안을 누르면 마커(image `경기도 성남시 분당구 판교역로 160`)와 `바꾸기` 버튼이 생기고 `이 조건으로 동네 찾기`가 활성화된다. `GET /api/maps/search`와 `GET /api/maps/geocode`가 200이다. 실제 지도에는 클릭할 `구역 경계 시안` 이미지가 없으므로 주소 검색이 uid로 닿는 길이다(좌표 클릭은 [지도](./map.md)의 스니펫).
- **목적지 고르기, DEMO MAP.** `지도에서 선택` 버튼 -> `구역 경계 시안` 이미지 클릭. `GET /api/maps/reverse-geocode` 200.
- **조건.** 기본은 `40분`, `1회 이하`다. 라디오 `10분`부터 `60분`, `환승 없음`, `1회 이하`, `2회 이하`로 바꾼다.
- **검색.** `이 조건으로 동네 찾기`를 누른다. `GET /api/commute-areas/with-rents?latitude=..&longitude=..&maxMinutes=40&maxTransfers=1`이 200이고 쿼리 값이 고른 조건과 같은지 본다.
- **결과 증명.** 스냅샷을 파일로 저장해 `찾은 동네` 아래 동네 버튼(`백현동 월세 105만원 1분` 형태)이 수백 개(판교역 40분은 204곳), 범례(`15분 이하`, `16~30분`, `31~40분`, `월세 정보 없음`), `최대 월세 시세` 슬라이더, `이 동네에서 본 방 기록하기` 버튼이 있는지 `grep`한다. 지도에는 동네 월세 라벨(`삼평동 월세 95만`)과 구역 경계, 목적지 풍선 `출퇴근 장소 선택한 지역`이 보인다. 스크린샷을 남긴다.
- **동네 상세.** 동네 버튼을 누르면 주소가 `/explore/areas/<행정동 코드>`(`백현동`은 31023760)로 바뀌고 `GET /api/commute-areas/route?...&stopId=..` 200, 지도에 굵은 경계선과 풍선(`소요시간`, `월세 105 / 1,000`)이 나온다.
- **성능.** `navigate_page`로 대상 주소를 연 뒤 `performance_start_trace`(`reload`, `ignoreCache`). 목적지는 저장돼 새로고침해도 자동 검색까지 간다. 측정 조건은 매번 적는다. 2026-11-22(스로틀 없음, webpack dev): DEMO MAP의 `/explore` LCP 2463 ms(TTFB 266 ms, 렌더 지연 2197 ms), 실제 지도의 `/explore/areas/31023760` LCP 3389 ms(TTFB 31 ms, 로드 지연 3171 ms, 렌더 지연 132 ms). 두 화면이라 직접 비교하지 않는다. CLS는 둘 다 0.00.

## Gotchas

- 지도 모드가 DEMO(`.env.local`에 네이버 키 없음)면 경계 시안만 보인다. 실제 타일과 마커는 검증하지 못한다고 보고한다. 스냅샷에 `NAVER` 링크가 있으면 실제 지도다.
- 결과 스냅샷은 동네 수백 개라 파일로만 저장한다.
- 검색 결과 호출은 인증이 필요하다. `POST /api/auth/login` 뒤에 나가는지 순서를 본다.
- 새로고침하면 마지막 목적지로 바로 검색한다. "처음 상태"를 보려면 새 탭이나 `new_page`에 `isolatedContext`를 준다.
- 휴대폰 레이아웃은 다른 컴포넌트다. 데스크탑 통과가 모바일 통과가 아니다.
- 월세가 없는 동네는 `내곡동 시세 없음 11분`(또는 `통근 11분 월세 정보 없음`)으로 나온다. 결함이 아니다.
- 증거 위치: 실제 지도 `qa/runs/verify-jachwi/finder-20261122/`, DEMO MAP `qa/runs/verify-jachwi/finder-20261122-demo/`.
