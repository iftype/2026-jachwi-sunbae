# 주소 검색

주소를 찾아 지도를 그 자리로 옮기는 화면(`/search`)과, 데스크탑 홈 리스트 위의 같은 검색 칸이다. 상태: 검증됨(2026-11-25, iPhone(WebKit)는 `/search`, 데스크탑은 홈 검색 칸).

## Sub-features

- `search-input` 검색 칸 `주소 검색`(자리 표시 `주소로 지도 이동`). 입력하는 대로 `GET /api/maps/search`를 부르고 `주소 검색 결과` 목록을 띄운다. 글자를 지우는 `검색어 지우기`.
- `search-records` 처음에는 `내 기록`(기록한 매물 주소)과 `최근 검색`을 보인다.
- `search-pick` 결과를 누르면 그 자리로 홈 지도가 옮겨 간다.

## How to get to it (user POV)

- 휴대폰: 홈 지도 머리의 링크 `주소 검색`(`/search`). 동네 찾기 머리에서는 `/search?target=neighborhoods`.
- 데스크탑: `/search`로 가는 링크가 없다. 홈 리스트 위 `주소 검색` 칸이 같은 일을 한다.

## 데스크탑과 iPhone(WebKit) 경로

- 실행(`qa`): `npm run test:iphone -- --device all address-search`. 코드는 `qa/tests/<desktop|iphone>/address-search.spec.ts`.
- iPhone:
  1. 홈에서 `주소 검색`을 누르면 주소가 `/search`이고 `내 기록`에 버튼 2개가 있다.
  2. `주소 검색`에 `세종대로`를 넣으면 `maps/search`가 200이고 `주소 검색 결과`에 `서울 중구 세종대로 110`이 뜬다.
  3. 그 결과를 누르면 홈(`/`)으로 돌아온다.
- 데스크탑:
  1. 홈에 `주소 검색` 링크가 없다(0개).
  2. 홈 검색 칸에 `세종대로`를 넣으면 `maps/search`가 200이고 결과를 누르면 목록이 닫힌다. 주소는 `/search`가 아니다.

## Gotchas

- 검색 버튼을 누르지 않는다. 입력하면 바로 찾고, 입력이 있으면 버튼 자리가 `검색어 지우기`로 바뀐다.
- 목의 검색은 무엇을 넣어도 `서울 중구 세종대로 110` 하나를 준다.
