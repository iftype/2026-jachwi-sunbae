# 체크리스트

방을 볼 때 항목별로 `괜찮음`, `주의`를 누르고 결과(괜찮음, 주의, 미확인)를 집계한다. 매물별 체크리스트와 내 체크리스트 목록이 있다. 상태: 검증됨(2026-11-22, 데스크탑 1440x900, 매물별 체크와 새로고침 유지까지. 새 체크리스트 만들기는 돌리지 않았다). iPhone(WebKit) 검증됨(2026-11-25, 매물별 체크와 집계).

## Sub-features

- `checklist-property-tab` 매물 상세 `체크리스트` 탭(`?tab=checklist`). 영역 `사용자 체크리스트`.
- `checklist-item` 분류별 항목(보안, 창문과 채광, 수도와 화장실, 방 상태, 기본 옵션, 12항목)에 `괜찮음`, `주의` 버튼과 항목별 메모 입력칸.
- `checklist-summary` 집계 `괜찮음`, `주의`, `미확인` 숫자와 `<전체>개 중 <평가한 수>개 평가` 상태 줄. 홈 리스트 카드에도 같은 숫자가 나온다.
- `checklist-replace` `교체` 링크(`/properties/:id/active-checklists/ON_SITE?mode=replace`). 단계별 체크 화면이다.
- `checklist-list` `내 체크리스트`, `새 체크리스트`(`/checklists`, `/checklists/new`).

## How to get to it (user POV)

- 이동 바 `화면 이동`의 `체크리스트`(`/checklists`).
- 매물 상세의 `체크리스트` 탭.
- 홈 리스트 카드의 `괜찮음`, `주의`, `미확인` 숫자(샘플은 6, 2, 4).

## Driving it with Chrome DevTools MCP

Preconditions: doctor 통과, 새 `isolatedContext`, 실제 매물 하나. 샘플 매물은 미리보기라 저장 검증에 쓰지 않는다. 매물은 [매물 상세](./property-detail.md)의 새 매물 만들기로 만든다.

- **탭 열기.** `/properties/<id>`에서 탭 `체크리스트`를 누른다. 주소가 `?tab=checklist`로 바뀌고 `GET /api/properties/<id>/checklists`와 `.../checklists/<체크리스트 id>`가 200이다. 새 매물은 `괜찮음 0 / 주의 0 / 미확인 12`, `12개 중 0개 평가`다.
- **체크.** 항목 아래 `괜찮음`을 누르고, 다른 항목의 `주의`를 누른다. 누른 버튼이 `pressed`가 되고 `PATCH /api/properties/<id>/checklists/<체크리스트 id>/items/<항목 id>/status`가 200이다. 집계가 `1 / 1 / 10`, `12개 중 2개 평가`로 바뀐다.
- **증명.** `reload` 뒤 `wait_for`로 `개 평가`를 기다려 집계와 눌림 상태가 남았는지 본다. 홈 리스트 카드 숫자도 같아야 한다.
- **내 체크리스트.** `new_page http://localhost:3217/checklists`. 새 회원은 `내 체크리스트 0개`, `저장된 체크리스트가 없어요. 나만의 체크리스트를 만들어 보세요.`, `새 체크리스트` 링크가 보인다.

## iPhone(WebKit) 경로

- 실행(`qa`): `npm run test:iphone`이 운영 빌드를 한 번 하고 `serve.mjs --api mock --delay 300`으로 띄워 iPhone 경로 전부를 돈다. 이 기능만은 `npm run test:iphone -- checklist`. 지도 키(`frontend/.env.local`의 `NAVER_MAP_CLIENT_ID`)가 있으면 실제 SDK, 없으면 `map-sdk-stub.mjs`다. 코드는 `qa/tests/iphone/checklist.spec.ts`.
- 경로:
  1. `/properties/10`을 열고 탭 `체크리스트`를 누른다. 주소에 `tab=checklist`가 붙는다.
  2. 처음 집계: `괜찮음 1`, `미확인 1`, 상태 `3개 중 2개 평가`.
  3. `주차가 가능한가요?` 묶음의 `괜찮음`을 누른다. 저장 요청(GET이 아닌 `/api/...`)이 성공한다.
  4. 끝 상태: 그 버튼이 눌린 상태이고 집계가 `괜찮음 2`, `미확인 0`, `3개 중 3개 평가`로 바뀐다.
- 경로 끝마다 우리 출처(`QA_BASE_URL`)의 콘솔 오류와 실패한 요청(4xx, 5xx, 끊김)이 0인지 본다. 스크린샷은 `qa/runs/iphone/shots/`의 `checklist.png`, 결과 요약은 `qa/runs/iphone/summary.md`다.

## Gotchas

- 초안에 적었던 `체크 항목 카테고리` 필터와 `체크리스트 진행 결과 집계` 목록 이름은 이 화면에 없다. 분류는 제목(`보안` 같은 heading)이고 집계는 위 이름이다.
- 항목 버튼은 `괜찮음`, `주의` 둘뿐이다. `미확인`은 누르는 값이 아니라 아직 안 누른 상태의 집계다.
- 서비스 기본 체크리스트는 수정할 수 없고 보기만 한다(코드 기준, 화면에서 확인하지 않았다).
- 데스크탑은 `/checklists`도 통합 지도 셸 안에 열린다(왼쪽 `체크리스트` 제목, 오른쪽 지도). 휴대폰은 앱 셸이라 구조가 다르다.
- 샘플 매물의 집계 `6 / 2 / 4`는 미리보기 숫자다.
- dev API 모드(기본은 mock이라 남지 않는다)에서 이 기능을 돌리면 dev DB의 매물에 체크 결과가 남는다. 매물을 지우면 같이 사라진다.
- 증거 위치: `qa/runs/verify-jachwi/checklist-20261122/`.
- iPhone 경로는 Playwright의 WebKit 엔진(리눅스 WPE 빌드)에 iPhone 15 기기 설정(화면 393x659, 터치, 모바일 UA, 배율 3)을 준 것이다. iOS 실기기의 Safari가 아니다. 주소창과 홈 표시줄이 줄이는 높이, 안전 영역(`safe-area-inset`), 키보드가 올라올 때의 화면 높이 변화, 관성 스크롤은 재현하지 않는다.
- 손가락 제스처는 흉내다. 탭은 터치 탭이지만 끌기(시트 손잡이)는 마우스 포인터 끌기로 낸다(`qa/src/iphone.ts`의 `dragBy`). 앱이 Pointer Events로 받아 같은 코드를 지나지만 실제 터치 이벤트 순서와 다를 수 있다. 핀치 확대와 지도 끌기는 하지 않는다(마우스 끌기로는 지도가 움직이지 않았다).
- 목 서버는 한 번 띄우는 동안 상태를 기억한다. 같은 서버로 다시 돌리면 처음 집계가 달라 실패한다. `npm run test:iphone`은 돌 때마다 서버를 새로 띄운다.
