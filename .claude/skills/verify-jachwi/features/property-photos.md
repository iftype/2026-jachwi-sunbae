# 매물 사진

매물 사진을 올리고, 지우고, 대표 사진을 고르는 사진 관리다. 휴대폰은 `/properties/:id/photos` 화면, 데스크탑은 매물 상세 옆 칸 안에서 열린다. 상태: 검증됨(2026-11-25, 데스크탑 1440x900과 iPhone(WebKit), 대표 사진 바꾸기). 사진 올리기는 목이 일부러 501이라 검증 못 함.

## Sub-features

- `photos-list` 영역 `사진 관리`의 목록. 사진마다 `업로드 순 <n>번째 사진`, 대표면 `업로드 순 <n>번째 사진 대표 사진`(눌림), 아니면 `업로드 순 <n>번째 사진을 대표 사진으로 지정`, `업로드 순 <n>번째 사진 삭제`.
- `photos-cover` 대표 지정 `PUT /api/properties/:id/photos/:photoId/representative`.
- `photos-upload` 영역 `사진 추가`의 `사진 파일 선택`(JPEG, PNG, WebP, 사진당 10MB 이하). `POST /api/properties/:id/photos`.

## How to get to it (user POV)

- 매물 상세 사진 칸의 사진 관리 링크. 휴대폰은 주소가 `/properties/<id>/photos`로 바뀌고, 데스크탑은 주소가 `/properties/<id>` 그대로이고 같은 칸 안에 열린다.

## 데스크탑과 iPhone(WebKit) 경로

- 실행(`qa`): `npm run test:iphone -- --device all property-photos`. 코드는 `qa/tests/<desktop|iphone>/property-photos.spec.ts`.
- 경로:
  1. `/properties/10`에서 사진 링크를 누른다. `사진 관리`에 사진 2장이 있고 1번째가 대표다.
  2. `업로드 순 2번째 사진을 대표 사진으로 지정`을 누르면 `representative` 요청이 성공하고 2번째가 대표로 눌린다.
  3. 다시 1번째를 대표로 되돌린다(목 상태를 처음대로 두려고).

## 검증 못 함

- 사진 올리기. 목은 `POST /api/properties/:id/photos`에 일부러 501로 답한다(`frontend/test/app/mocks/handlers.test.ts`의 `성공 응답으로 위장하지 않는다`). 올리기는 실제 저장소가 있어야 하는 동작이라, 볼 때는 dev API 모드가 필요하다(주인 허락 없이는 쓰지 않는다).

## Gotchas

- 매물 상세 경로가 매물 10의 사진 2장을 보므로, 이 경로는 끝에 대표를 되돌린다.
