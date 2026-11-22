# 거리 메모

지도에서 자리를 골라 좋아요 또는 별로예요 평가와 메모를 남긴다. 남긴 평가는 나만 볼 수 있다. 사용방법의 영상 문구는 "정자동 지도에서 자리를 골라 좋아요와 함께 거리 메모를 남기기"다. 상태: 초안. 코드(`features/street-memo`)에서 뽑았고 화면에서 돌려 본 적이 없다.

## Sub-features

- `memo-create` 지도에서 자리를 골라 평가와 메모를 저장한다(`이 장소를 평가해 주세요`).
- `memo-markers` 홈 지도에 좋은 곳과 나쁜 곳 마커가 보인다.
- `memo-details` 마커를 눌러 상세를 연다. 닫기는 `메모 닫기`.
- `memo-impression-log` 인상 기록 목록.

## How to get to it (user POV)

- 홈(`/`) 지도에서 위치를 눌러 메모를 남긴다. 데스크탑은 패널, 휴대폰은 시트로 열린다.
- 사용방법 화면 `/guide`의 `거리 메모 남기기` 데모.

## Driving it with Chrome DevTools MCP

Preconditions: doctor 통과, 새 익명 회원.

- **열기.** `new_page http://localhost:3217/`, 로딩이 끝나길 기다린다. 지도 `구역 경계 시안`을 클릭해 위치를 고르고 나타나는 패널에서 `이 장소를 평가해 주세요`를 찾는다.
- **저장.** 평가와 메모를 넣고 저장한다. `list_network_requests`에서 street memo 생성 요청이 2xx인지, 새로고침 뒤 마커가 남는지 본다.
- **증명.** 저장 전후 스크린샷, 생성 요청과 목록 재조회, 새로고침 뒤 마커.

## Gotchas

- 정확한 버튼 이름과 API 경로는 처음 돌릴 때 확정한다(`features/street-memo/api/streetMemoApi.ts` 참고). 지금 적힌 것은 코드의 문구다.
- 평가는 본인만 볼 수 있어, 다른 회원 컨텍스트(`isolatedContext`)에서 안 보이는지가 함께 확인할 거리다.
- 이 기능을 돌리면 dev DB에 메모가 생긴다. 끝나면 삭제한다.
