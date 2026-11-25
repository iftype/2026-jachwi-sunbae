# 인증

로그인 화면 없이 처음 열 때 익명 회원을 받는 자동 로그인과, Access Token이 만료돼 401을 받으면 한 번 갱신해 다시 보내는 동작이다. 상태: 검증됨(2026-11-25, 데스크탑 1440x900과 iPhone(WebKit)).

## Sub-features

- `auth-anonymous` 처음 열면 `POST /api/auth/login`으로 익명 회원과 Access Token을 받는다. 이후 요청은 `Authorization: Bearer <토큰>`을 단다. `/login`은 `/`로 보낸다.
- `auth-refresh` 401을 받으면 `POST /api/auth/refresh`로 새 토큰을 받아 같은 요청을 한 번 다시 보낸다(`features/auth/api/apiClient.ts`). 다시 401이면 인증을 끝낸다. 그 API의 업무 오류 401(`nonSessionUnauthorizedCodes`)은 갱신하지 않는다.

## 데스크탑과 iPhone(WebKit) 경로

- 실행(`qa`): `npm run test:iphone -- --device all auth`. 코드는 `qa/tests/<desktop|iphone>/auth.spec.ts`.
- 자동 로그인: 새 브라우저로 `/`를 열면 `auth/login`이 200이고, `GET /api/properties`가 `Bearer local-msw-access-token-1`을 달고 나간다. `기록한 동네`에 `전체2`가 보인다.
- 401 갱신: 첫 `GET /api/properties` 응답만 네트워크에서 401(`ACCESS_TOKEN_EXPIRED`)로 바꾼다(목은 토큰 만료를 흉내 내지 않는다. 앱 코드는 그대로). 요청 순서가 `POST auth/login 200`, `GET properties 401`, `POST auth/refresh 200`, `GET properties 200`이고 화면에 `전체2`가 보인다. 일부러 낸 401과 그 콘솔 줄만 판정에서 뺀다(`expectedProblems`).

## Gotchas

- 목의 갱신은 늘 지금 회원으로 성공한다. 갱신이 거절되는 경우(Refresh 쿠키 없음)는 목에서 로그아웃이나 탈퇴 뒤에만 생긴다.
- dev API 모드라면 이 경로가 dev DB에 익명 회원을 만든다. 기본은 mock이라 남는 것이 없다.
