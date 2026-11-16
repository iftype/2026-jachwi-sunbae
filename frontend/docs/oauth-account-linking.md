# OAuth 계정 연결

익명으로 쓰다가 필요할 때 카카오나 Apple 계정을 연결해 기록을 보관하고 다른 기기에서 이어 쓴다. 정책은 [회원과 인증 기능 명세](../../docs/product/specs/authentication.md)를 따르고, 백엔드 API는 [PR #570](https://github.com/woowacourse-teams/2026-jachwi-sunbae/pull/570)을 그대로 쓴다.

OAuth는 **웹(브라우저)에서 먼저 출시**한다. 앱 WebView에서는 네이티브 로그인 브리지([PR #591](https://github.com/woowacourse-teams/2026-jachwi-sunbae/pull/591), 앱 2.2.0)가 있을 때만 네이티브 로그인(Apple 로그인 시트, 카카오 SDK)으로 열고, 아니면 숨긴다. 출시 순서와 이유는 [#570 코멘트](https://github.com/woowacourse-teams/2026-jachwi-sunbae/pull/570#issuecomment-6635306937)를 참고한다.

## 보여 줄지 정하기

`features/auth/model/oauthAvailability.ts`의 `getAvailableOAuthProviders()`(와 `isOAuthLinkAvailable()`)로 카드, 버튼, 복귀 화면을 모두 판단한다.

| 환경                                                              | 계정 연결                  |
| ----------------------------------------------------------------- | -------------------------- |
| 브라우저                                                          | 카카오, Apple              |
| 앱 WebView(2.1.x 이하, `features`에 `auth` 없음)                  | 숨긴다                     |
| `features`에 `auth`를 알린 앱                                     | `authProviders`의 제공자만 |
| 위 앱이지만 `authProviders`가 비었거나 서버에 API가 없다고 확인함 | 숨긴다                     |

앱용 `/nonce`, `/id-token` API(#646)는 웹보다 먼저 배포한다. 순서가 뒤집히면 그 사이에 버튼을 누른 앱에서는 아래 서버 미지원 처리로 하루 동안 숨는다.

서버의 `/nonce`나 `/id-token`이 404, 405, 501이면 서버 미지원으로 보고 `localStorage`의 `jachwi:native-oauth-unsupported`에 하루 동안 남겨 그동안 앱에서 숨긴다. 앱 버전은 따로 비교하지 않는다. `auth`와 `authProviders`는 브리지를 넣은 앱만 알리기 때문이다.

앱인지는 `window.__JACHWI_NATIVE_APP__`이나 앱 User-Agent(`JachwiSunbae/`)로 본다. 앱 WebView에서 `/oauth/complete`로 들어오면 아무것도 하지 않고 마이로 보낸다. 앱을 다시 빌드하지 않아도 웹 배포만으로 숨겨진다.

## 화면

마이의 계정 연결 카드(`pages/my/ui/account-link-card`)가 상태에 따라 버튼을 바꾼다.

| 상태             | 보여 주는 것                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| 연결하지 않음    | `로그인하고 동기화하기` 제목, 카카오로 계속하기, Apple로 계속하기                                    |
| 한 계정을 연결함 | 계정 색 동그라미(카카오 노랑, Apple 검정)와 `카카오 계정으로 로그인됨` 프로필 줄, 회색 로그아웃 알약 |

확인 창은 #570 `completeOAuth`, `mergeOwnedData` 규칙대로 알린다(POL-AUTH-021).

- 익명 회원: 매물(사진, 메모, 체크 기록 포함), 체크리스트, 거리 메모를 그 계정에 보관한다. 이미 쓰던 계정이면 그쪽으로 합치고, 날씨 위치와 알림 설정은 계정에 있던 값을 쓴다.
- 계정을 연결한 회원이 다른 계정을 고르면 합치지 않고 그 계정으로 바꾼다. 처음 쓰는 계정이면 빈 기록으로 시작한다.
- 로그아웃은 이 기기에서만 끝나고 같은 계정으로 다시 인증하면 돌아온다.

연결 상태는 아직 서버가 알려 주지 않는다. 이 기기에서 인증을 마쳤을 때 `localStorage`의 `jachwi:oauth-link`에 회원 번호와 제공자를 남기고, 같은 회원일 때만 연결됨으로 보인다.

## 흐름

백엔드 콜백은 인증을 시작한 브라우저의 Refresh 쿠키(`SameSite=Lax`, `Path=/api/auth`)를 요구한다. 제공자 화면에서 콜백으로 오는 이동은 최상위 GET 이동이라(Apple도 `response_mode=query`) 같은 브라우저 안이면 쿠키가 함께 간다.

1. 확인하면 `POST /api/auth/oauth/{KAKAO|APPLE}/start`를 Access Token과 Refresh 쿠키를 함께 실어 보낸다. 쿠키를 확인하지 못한 `401 OAUTH_AUTHENTICATION_FAILED`는 Access Token 만료가 아니므로 토큰을 갱신하거나 인증을 끝내지 않고 안내만 한다.
2. 시작 정보(이전 회원 번호, 연결 계정)를 `sessionStorage`의 `jachwi:oauth-pending`에 남기고 지금 페이지를 받은 제공자 주소로 옮긴다.
3. 서버가 콜백을 검증해 이 브라우저의 Refresh 쿠키를 바꾸고 `/oauth/complete`로 303을 보낸다(`OAUTH_SUCCESS_REDIRECT_URI`, 비어 있으면 204). 결과는 쿼리로 주지 않는다.
4. `/oauth/complete`는 이전 회원의 토큰과 캐시를 모두 버리고 새 쿠키로 다시 로그인한다. 시작 정보와 비교해 결과를 정하고 마이로 보내 안내한다.
   - 같은 회원: 처음 연결했다.
   - 다른 회원, 익명이었음: 이미 연결된 회원의 기록에 이 기기의 기록을 합쳤다.
   - 다른 회원, 다른 계정을 연결했었음: 그 계정으로 바꿨다.
5. 시작에 실패하면 지금 회원과 인증을 그대로 두고 안내만 한다.
6. 취소하거나 콜백이 실패하면 #570은 API 도메인의 JSON 오류로 끝나 사용자가 뒤로 가기로 돌아온다. 마이를 다시 볼 때 쓰지 않은 시작 정보가 남아 있으면 "계정 연결을 마치지 못했어요"로 알린다(취소와 실패는 구분하지 못한다). 뒤로 가기가 페이지를 메모리에서 되살리면(bfcache) 진행 중 버튼과 확인 창도 되돌린다.

결과는 서버가 알려 주지 않아 시작 전후 회원으로 추정한다. 이 기기가 연결 상태를 잃었으면 전환을 통합으로 볼 수 있다.

로그아웃은 `POST /api/auth/logout`으로 이 기기의 Refresh Token만 폐기하고, 쿠키 없이 로그인해 새 익명 회원으로 홈에 간다. 실패하면 지금 회원을 그대로 둔다.

## 앱 네이티브 흐름

앱 WebView 안에서 제공자 로그인 화면을 열지 않는다(RFC 8252). 앱은 `id_token`만 받아 웹에 넘기고, 서버는 WebView가 쿠키를 실어 부른다. 코드는 `features/auth/model/oauthFlow.ts`의 `startNativeOAuthLink`, 브리지는 `features/auth/lib/nativeAuthBridge.ts`다.

1. `POST /api/auth/oauth/{KAKAO|APPLE}/nonce`를 Access Token과 Refresh 쿠키를 실어 보내 `{ nonce }`를 받는다.
2. `window.ReactNativeWebView.postMessage({ type: 'auth', action: 'login', requestId, provider: 'kakao'|'apple', nonce })`로 앱에 로그인을 요청하고, 같은 `requestId`의 `jachwi-auth` 이벤트를 기다린다(5분). 앱은 nonce를 해시하지 않고 그대로 제공자에 넘긴다.
3. 성공하면 `POST /api/auth/oauth/{provider}/id-token`에 `{ idToken, authorizationCode?, nonce }`를 쿠키와 함께 보낸다. Apple은 `authorizationCode`도 보낸다.
4. 서버가 기존 `completeOAuth`로 Refresh 쿠키를 바꾸면 웹 흐름의 4번과 같이 다시 로그인해 결과를 정한다. 페이지를 떠나지 않으므로 캐시는 비우지 않고 초기화해 지금 화면이 다시 불러오게 하고, 안내는 마이 카드에 바로 띄운다.

| 경우                                | 안내                           | 서버 호출                |
| ----------------------------------- | ------------------------------ | ------------------------ |
| 앱에서 취소                         | 계정 연결을 취소했어요         | `/nonce`만               |
| 앱 `not_configured`, `unavailable`  | 지금은 계정을 연결할 수 없어요 | `/nonce`만               |
| 앱 `failed`, 응답 없음(5분)         | 계정을 연결하지 못했어요       | `/nonce`만               |
| 서버 API 없음(404 등)               | 지금은 계정을 연결할 수 없어요 | 그 뒤로 하루 동안 숨긴다 |
| `/id-token`이 토큰이나 nonce를 거절 | 계정을 연결하지 못했어요       | 회원은 그대로            |

로컬 목(`npm run dev:mock`)은 `/nonce`가 일회용 값을 주고, `/id-token`은 토큰을 검증하지 않고 그 nonce만 확인해 204로 답한다.

## 다른 탭

로그인으로 회원이 정해질 때마다 `BroadcastChannel('jachwi-auth')`로 회원 번호를 알린다. 다른 회원으로 남아 있던 탭은 Access Token과 캐시를 바로 버려 늦게 온 응답을 쓰지 않고, 화면을 새로 열어 바뀐 쿠키로 다시 인증한다. 숨은 탭은 다시 보일 때 새로 연다.

## 분석 이벤트

연결은 마이 카드에서만 시작한다. 화면 흐름 중간에 연결을 권하는 진입점은 아직 없다(매물 등록 수 같은 시점의 제안은 따로 만든다). 이벤트 이름과 속성 타입은 `features/auth/lib/oauthAnalytics.ts`에 둔다.

| 이벤트                 | 발생 시점                                                        | 속성                                                                     |
| ---------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `oauth_link_started`   | 시작 API가 성공해 제공자 화면으로 떠나기 직전. Beacon으로 보낸다 | `provider`, `already_linked`, `property_count`                           |
| `oauth_link_completed` | 복귀 화면에서 새 쿠키로 다시 로그인한 뒤                         | `provider`, `outcome`(`linked`/`merged`/`switched`), `property_count`    |
| `oauth_link_cancelled` | 완료 없이 돌아와 마이를 다시 볼 때(취소와 콜백 실패 구분 못함)   | `provider`, `property_count`                                             |
| `oauth_link_failed`    | 시작 API가 실패했을 때                                           | `provider`, `reason`(`session`/`unavailable`/`failed`), `property_count` |

앱 네이티브 흐름도 같은 이벤트를 쓰고 `flow: 'native'`를 더한다. `oauth_link_started`는 `/nonce`가 성공해 앱에 로그인을 요청하기 직전, `oauth_link_cancelled`는 앱이 취소로 답했을 때 남긴다. `oauth_link_failed`는 `/nonce`, 앱 로그인, `/id-token` 어디서 실패해도 남기고 `native_reason`(`server_unsupported`, `not_configured`, `bridge_unavailable`, `timeout`, `token_rejected`, `bridge_failed`)을 더한다. 앱이 주는 `message` 원인 코드는 싣지 않는다.

- `provider`는 `kakao`, `apple`이다. 복귀 화면에서 시작 정보를 잃었으면 `unknown`이다.
- `property_count`는 그 시점 지금 회원의 매물 수다. 완료는 바뀐 회원(통합이면 합친 뒤) 기준이다. 목록 캐시가 없으면 목록을 한 번 받아 세고, 받지 못하면 `first_property`처럼 속성을 빼고 보낸다.
- `outcome`은 시작 정보가 없어 결과를 모르면 뺀다.
- 사용자가 돌아오지 않고 탭을 닫으면 `oauth_link_cancelled`는 남지 않는다.
- 로그아웃은 `logout_succeeded`, `logout_failed`(`error_kind`, `error_code`)로 남긴다. 제공자 응답이나 토큰은 싣지 않는다.

## 한계

- 제공자 화면에서 취소하거나 콜백이 실패하면 지금 백엔드는 JSON 오류를 그대로 보여 준다. 회원과 기록은 그대로이고, 사용자는 뒤로 가기로 돌아온다.
- `OAUTH_SUCCESS_REDIRECT_URI`는 HTTPS 하나만 받아 로컬(`http://localhost`)에서는 끝까지 확인할 수 없다.
