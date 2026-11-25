# 방 비교

기록한 매물을 1개에서 5개까지 골라 모든 기록을 비교 PDF 한 장으로 받는 화면(`/compare`)이다. 예전의 비교 표는 없고, 고른 매물을 PDF로 받는다. 상태: 검증됨(2026-11-25, 데스크탑 1440x900과 iPhone(WebKit), 매물 둘을 골라 PDF 받기).

## Sub-features

- `compare-select` 월세와 체크리스트 필터로 좁히고 매물을 체크한다.
- `compare-pdf` 고른 매물의 비교 PDF를 받는다(`POST /api/properties/export.pdf`).

## How to get to it (user POV)

- 휴대폰: 홈 리스트(`하단 탭`의 `내 기록, 리스트로 보기`)의 `기록 비교하고 PDF로 받기` 링크.
- 데스크탑: 왼쪽 `화면 이동`의 `방 비교`, 또는 홈 리스트의 같은 링크. 마이의 바로가기 `방 비교`도 같다.

## 데스크탑 경로

- 실행(`qa`): `npm run test:desktop -- compare`. 코드는 `qa/tests/desktop/compare.spec.ts`.
- 경로:
  1. `/`에서 `화면 이동`의 `방 비교`를 누르면 주소가 `/compare`이고 제목 `비교할 매물 선택`(화면 읽기용)과 `매물 필터`(월세, 체크리스트)가 있다.
  2. `비교할 매물 목록`의 체크박스 2개를 체크하면 `2개 선택`이 보인다.
  3. `선택한 2개 PDF 받기`를 누르면 `POST /api/properties/export.pdf`가 200이고 `jachwi-sunbae-property-comparison-<날짜>.pdf` 내려받기가 일어난다.
- 데스크탑은 매물을 고르면 옆에 `매물 미리 보기`를 열어 그 매물 상세를 부른다. 다음 매물을 고르면 앞 요청을 취소한다. 의도한 동작이라 경로는 그 취소만 판정에서 뺀다(`expectedProblems`).

## iPhone(WebKit) 경로

- 실행(`qa`): `npm run test:iphone -- compare`. 코드는 `qa/tests/iphone/compare.spec.ts`. 실행 조건은 [지도](./map.md)의 iPhone 경로와 같다.
- 경로:
  1. `/`를 열고 `하단 탭`의 `내 기록, 리스트로 보기`를 누른 뒤 `기록 비교하고 PDF로 받기`를 누른다. 주소가 `/compare`다.
  2. `비교할 매물 목록`에 체크박스 2개(`망원동 투룸`, `신림역 원룸`)가 있다. 둘 다 체크하면 `2개 매물의 모든 기록을 PDF로 만들어요.`가 보인다.
  3. `선택한 2개 PDF 받기`를 누른다.
  4. 끝 상태: `POST /api/properties/export.pdf`가 200이고 `jachwi-sunbae-property-comparison-<날짜>.pdf` 내려받기가 일어난다.
- 경로 끝에 우리 출처의 콘솔 오류와 실패한 요청이 0인지 본다. 스크린샷은 `qa/runs/iphone/shots/compare.png`다.

## Gotchas

- iPhone 경로는 WebKit 엔진에 iPhone 15 기기 설정을 준 것이고 iOS 실기기의 Safari가 아니다. 실제 iOS Safari는 블롭 주소 내려받기를 미리보기나 공유 시트로 보여 줄 수 있는데, 여기서는 Playwright의 `download` 사건만 본다.
- 목은 PDF 내용을 만들지 않고 짧은 PDF 머리만 준다. PDF 모양은 dev API 모드에서만 볼 수 있다.
- 화면을 열면 `POST /api/properties/comparison-views`(204)를 한 번 보낸다. Chromium은 본문을 읽지 않은 204를 받은 뒤에도 `net::ERR_ABORTED`로 한 번 더 알린다. 요청은 성공했고 fetch 하나로 재현되는 브라우저 쪽 표시라, 공용 픽스처(`qa/src/iphone.ts`)가 이 경우만 세지 않는다.
