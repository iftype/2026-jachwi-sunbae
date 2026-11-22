# 체크리스트

방을 볼 때 항목별로 체크하고 결과(괜찮음, 주의, 미확인)를 집계한다. 매물별 체크리스트와 내 체크리스트 목록이 있다. 상태: 초안.

## Sub-features

- `checklist-property-tab` 매물 상세 `체크리스트` 탭.
- `checklist-active` 단계별 체크(`/properties/:id/active-checklists/:stage`).
- `checklist-summary` `체크리스트 진행 결과 집계`(괜찮음, 주의, 미확인 개수).
- `checklist-list` `내 체크리스트`, `새 체크리스트`(`/checklists`, `/checklists/new`).
- `checklist-category` `체크 항목 카테고리` 필터.

## How to get to it (user POV)

- 이동 바의 `체크리스트`.
- 매물 상세의 `체크리스트` 탭.
- 홈 리스트 카드의 결과 숫자(샘플은 괜찮음 6, 주의 2, 미확인 4).

## Driving it with Chrome DevTools MCP

Preconditions: doctor 통과, 새 익명 회원.

- **목록.** `new_page http://localhost:3217/checklists`. `내 체크리스트`와 `새 체크리스트`를 찾는다.
- **매물별.** `/properties/-1`에서 `체크리스트` 탭. `체크 항목 카테고리`와 `체크리스트 진행 결과 집계` 목록을 스냅샷으로 확인한다.
- **증명.** 항목을 하나 바꾸고 집계 숫자가 바뀌는지, 새로고침 뒤에도 남는지(해당 PUT 또는 PATCH 200)를 본다.

## Gotchas

- 서비스 기본 체크리스트는 수정할 수 없고 보기만 한다.
- 데스크탑은 `ChecklistsRoute`가 통합 지도 셸을, 휴대폰은 앱 셸을 쓴다. 같은 주소라도 구조가 다르다.
- 샘플 매물의 집계는 미리보기 숫자다. 저장 검증은 실제 매물로 한다.
