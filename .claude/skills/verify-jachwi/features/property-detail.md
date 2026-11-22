# 매물 상세

기록한 방 하나의 정보, 사진, 메모, 체크리스트를 보고 고치는 화면이다. 데스크탑은 지도 왼쪽 패널에 `선택한 매물 상세`로 열린다. 상태: 초안. 탭과 필드는 스냅샷으로 확인했다.

## Sub-features

- `detail-open` 리스트 카드나 마커로 연다.
- `detail-info-edit` `매물 이름`, `보증금 / 월세`, `주소`를 항목별로 수정한다.
- `detail-tabs` 탭 `정보`, `체크리스트`.
- `detail-navigate` `이전 매물`, `다음 매물`, `목록으로 돌아가기`.
- `detail-photos`, `detail-memo`, `detail-edit` 사진(`/properties/:id/photos`), 메모(`/memo`), 편집(`/edit`).

## How to get to it (user POV)

- 홈 리스트의 카드 링크나 지도 마커.
- 주소창 `/properties/<id>`. 샘플은 `/properties/-1`.

## Driving it with Chrome DevTools MCP

Preconditions: doctor 통과, 새 익명 회원(샘플 매물 있음).

- **열기.** `new_page http://localhost:3217/properties/-1`, `선택한 매물 상세` 영역과 제목 `(미리보기) 코엑스 근처`를 `wait_for`한다.
- **기본 정보.** `기본 정보` 아래 `보증금 / 월세 3,000만원 / 55만원, 수정`, `주소 서울 강남구 영동대로 513, 수정` 버튼이 있다.
- **탭.** `체크리스트` 탭을 눌러 선택 상태가 바뀌고 주소가 `?tab=checklist` 계열로 바뀌는지 본다.
- **수정 증명.** 샘플은 서버 기록이 아닐 수 있다. 저장 검증은 실제 매물을 만든 뒤에 하고, 수정 후 새로고침해서 값이 남는지 `list_network_requests`의 PUT 또는 PATCH 200과 함께 본다.

## Gotchas

- `/properties/-1`은 미리보기라 수정이 서버에 저장되지 않을 수 있다. 처음 돌릴 때 확인해 이 절을 고친다.
- 매물 등록은 지도에서 찍은 위치로 한다(`/properties/new`는 지도로 넘어간다).
- 이 기능을 돌리면 dev DB에 매물이 생긴다. 끝나면 삭제 경로(`<매물 이름> 메뉴`)로 지운다.
