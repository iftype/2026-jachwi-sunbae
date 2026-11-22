# 지도

홈(`/`)은 본 방 기록 지도다. 왼쪽에 기록 리스트, 오른쪽에 지도가 있다. 지도에는 기록한 매물 마커, 주소 검색, 동네별 필터, 거리 메모 마커가 있다. 상태: 검증됨(2026-11-22, 데스크탑 1440x900, 실제 네이버 지도).

## Sub-features

- `map-markers` 기록한 매물이 지도 마커(버튼 `<매물 이름>`)와 리스트 카드로 같이 보인다.
- `map-address-search` `주소 검색`에 입력하면 제안 버튼이 뜨고, 고르면 지도가 옮겨 가고 검색 위치 마커(버튼 `<도로명 주소>`)가 생긴다.
- `map-dong-filter` `기록한 동네` 아래 `전체<n>`과 구 이름 버튼(`강남구1`). 누르면 `<구> 매물 <n>개` 제목과 `전체 리스트로 돌아가기`가 나온다. 주소가 없는 매물은 `주소 미등록` 버튼으로 묶인다.
- `map-click-menu` 지도 빈 곳을 누르면 메뉴 `이 위치에서`(`메모 남기기`, `본 방 기록하기`)가 뜬다. 거리 메모와 매물 등록의 입구다.
- `map-facility-layers` 매물 상세를 연 동안만 `지도 시설 카테고리`(`교통 표시하기`, `편의점 표시하기`, `병원 표시하기`, `중개업소 표시하기`)가 나온다. 켜면 이름이 `... 숨기기`로 바뀌고 눌림 상태가 된다.
- `map-zoom-locate` `지도 확대`, `지도 축소`, `현재 위치로 이동`.

## How to get to it (user POV)

- 주소창 `/`. `/map`과 `/properties`는 `/`로 넘어간다.
- 이동 바(`화면 이동`)의 `내 기록`.

## Driving it with Chrome DevTools MCP

Preconditions: doctor 통과, `frontend/.env.local`에 네이버 키가 있다(스냅샷에 `NAVER` 링크가 보이면 실제 지도). 새 `isolatedContext`는 새 익명 회원이다.

- **열기.** `new_page http://localhost:3217/`(`isolatedContext` 지정), `wait_for`로 `NAVER`를 기다린다. 첫 방문에는 지도 안에 `이렇게 방을 기록해요. 빈 곳을 눌러 메모도 남겨요`와 `확인` 버튼이 있다. 먼저 `확인`을 누른다.
- **마커와 리스트.** 리스트 카드 링크 `(미리보기) 코엑스 근처`와 지도의 버튼 마커 `(미리보기) 코엑스 근처`가 둘 다 있다.
- **주소 검색.** `주소 검색` 텍스트박스에 `fill`하면 `검색` 버튼을 누르지 않아도 제안 버튼이 뜬다. 첫 제안을 누르면 지도가 옮겨 가고 `GET /api/maps/search`, `GET /api/maps/geocode`, 옮겨진 범위의 `GET /api/street-memos?minLatitude=..` 가 200이다.
- **동네 필터.** `강남구1`을 누르면 제목 `강남구 매물 1개`와 `전체 리스트로 돌아가기`가 나온다.
- **마커 클릭.** 마커 버튼을 누르면 주소가 `/properties/-1`로 바뀌고 오른쪽에 `선택한 매물 상세`가 열린다.
- **시설 카테고리.** 상세가 열린 뒤 `편의점 표시하기`를 누른다. `GET /api/maps/nearby?...radius=500&categories=CONVENIENCE`가 500m 격자로 여러 번(11번) 200이고 초록 마커(`GS25 삼성터미널점` 같은 이름의 버튼)가 생긴다. 실제 데이터다.
- **지도 빈 곳 클릭.** MCP `click`은 uid만 받아 좌표를 못 누른다. `evaluate_script`로 그 좌표의 요소에 `pointerdown`, `mousedown`, `pointerup`, `mouseup`, `click` 이벤트를 차례로 디스패치하면 앱이 사용자 클릭으로 받아 메뉴가 뜬다(Playwright면 `page.mouse.click(x, y)`).

```js
() => {
  const x = 900,
    y = 250;
  const el = document.elementFromPoint(x, y);
  const o = { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window, button: 0, pointerId: 1, pointerType: 'mouse', isPrimary: true };
  for (const t of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    el.dispatchEvent(t.startsWith('pointer') ? new PointerEvent(t, o) : new MouseEvent(t, o));
  }
  return el.tagName;
};
```

- **증명.** 스크린샷, 스냅샷 파일, 위 네트워크 호출, 마커 클릭 뒤 주소 변화.

## Gotchas

- 시설 카테고리는 홈 첫 화면에 없다. 매물 상세를 열어야 나온다(초안의 "홈에서 편의점 표시하기"는 틀렸다).
- 샘플 매물 `(미리보기) 코엑스 근처`는 회원이 방을 하나라도 등록하면 사라진다. 실제 기록 저장은 [매물 상세](./property-detail.md)를 따른다.
- 주소 검색 제안 버튼은 같은 주소가 세 번 나오기도 한다. 첫 버튼을 쓴다.
- 지도를 옮길 때마다 `street-memos`가 그 범위로 다시 불린다. 요청이 많은 것은 정상이다.
- 휴대폰은 `RecordsMobilePage`라 리스트와 지도가 `리스트`, `지도` 토글로 나뉜다. 이 문서는 데스크탑만 돌렸다.
- 증거 위치: `qa/runs/verify-jachwi/map-20261122/`.
