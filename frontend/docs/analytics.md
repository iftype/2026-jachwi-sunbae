# PostHog 수집 코드 관리

## 책임과 위치

`src/shared/lib/analytics/posthog.ts`는 기존 호출부가 사용하는 안정된 진입점이다. SDK는 정적으로 import하지 않는다. 수명주기 상태는 한 런타임이 소유하며 파일별 전역 상태를 함께 초기화하는 조립 로직은 없앤다.

| 모듈 (`shared/lib/analytics/posthog/`)    | 책임                                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| `runtime.ts`                              | SDK lazy load·초기화·큐·공통 속성·식별·페이지뷰 캐시의 단일 상태 소유자, 실패 진단 |
| `configuration.ts`                        | 공개 설정 검증, 마스킹·자동 수집 옵션                                              |
| `platform.ts`                             | 기기 컨텍스트를 사용해 앱 주입 정보·자취선배 전용 UA로 플랫폼 분류                 |
| `errorClassification.ts`, `exceptions.ts` | 순수 오류 분류와 오류 전송                                                         |
| `webVitals.ts`                            | Web Vitals(LCP, INP, CLS, FCP, TTFB)를 따로 받은 청크에서 재서 `web_vital`로 전송  |
| `types.ts`                                | SDK·공통 속성·오류 등급 타입                                                       |

`app/analytics/PostHogTracker.tsx`는 React와 SDK 수명주기를 연결한다. 초기화·공통 속성·식별은 layout effect에서 처리해 페이지의 첫 effect 이벤트가 초기화보다 먼저 실행되어 버려지지 않게 한다. 페이지뷰는 그 이후 전송한다. 로그인은 수집의 전제 조건이 아니며 익명 방문에서도 경로와 기능 이벤트를 수집한다.

등록·메모 이벤트 이름과 필수 속성 타입은 소유 기능의 `features/property/lib/propertyAnalytics.ts`에 둔다. 사용 방법과 랜딩은 공용 `LogScreen`, `LogClick`으로 진입과 버튼 클릭만 남기고 별도 이벤트 파일을 두지 않는다. 지도 마커처럼 React 컴포넌트로 감쌀 수 없는 대상의 노출은 공용 `LogImpression`에 지금 화면에 보이는 항목 목록을 넘겨, 항목마다 한 방문에 한 번만 남긴다. shared는 도메인 이벤트 목록을 알지 않는다. 기존 이벤트 전체를 한 번에 이관하지 않고 이번에 정비한 경계부터 타입 계약을 적용한다. 제품 목표와 이벤트 해석은 [지표 기준](analytics-goals.md)을 따른다.

## 이벤트 추가·수정 기준

- 화면 방문·UI 행동은 소유 페이지/기능에서 기록한다. 성공은 클릭 시점이 아니라 API 성공 경계에서 기록한다.
- 여러 화면에서 같은 기능을 호출하면 성공·실패 이벤트는 공통 mutation에 한 번만 둔다. `useCreateProperty`가 제출·생성 성공·생성 실패 이벤트를 소유하며 매물을 만드는 본 방 기록 지도에서 중복 전송하지 않는다.
- React state updater 안에서는 이벤트를 전송하지 않는다. 매물 비교 선택은 이벤트 핸들러에서 한 번만 기록하며, StrictMode나 한 번에 여러 선택이 발생해도 선택 수를 정확히 유지한다.
- `first_property`는 생성 전 캐시에서 전체 매물 수를 아는 경우에만 보낸다. 캐시가 없다고 첫 매물로 추정하지 않는다.
- 기존 인사이트가 참조하는 이벤트 이름을 임의로 바꾸지 않는다. 새 필수 속성은 의미와 발생 시점을 문서화하고 테스트한다.
- 토큰, 입력 주소, 보증금, 사용자 입력 원문 등을 추가 속성으로 보내지 않는다. 회원은 회원 ID(`member-<id>`)로만 식별하고 리플레이 마스킹 정책은 유지한다.
- 예외로 거리 메모는 지도에서 누구나 보는 공개 글이라, 메모별 순위를 보려고 노출·열람 이벤트에 메모 내용을 싣는다. 쓴 사람은 싣지 않는다.

## 거리 메모 노출과 열람

메모별 노출 순위와 열람 순위를 PostHog에서 보려고 두 이벤트에 `memo_id`, `preference`(`LIKE`/`DISLIKE`), `memo`(내용)를 싣는다.

| 이벤트                  | 발생 시점                                                                                                                                                                                                                                                                     | 추가 속성                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `street_memo_impressed` | 본 방 기록 지도와 동네 찾기 지도에서 메모가 화면 안에 보일 때. 메모마다 한 방문에 한 번 (`StreetMemoImpressionLog`). 화면 위도 폭이 약 3.3km(0.03도)를 넘게 축소하면 메모가 뭉쳐 내용이 보이지 않고 이벤트가 쏟아지므로 세지 않는다. 겹쳐 묶인 말풍선은 안의 메모를 각각 센다 | `memo_id`, `preference`, `memo`               |
| `street_memo_viewed`    | 메모 말풍선을 눌러 열 때. 묶인 말풍선은 안의 메모를 하나씩 남긴다                                                                                                                                                                                                             | `memo_id`, `preference`, `memo`, `group_size` |

순위는 Trends에서 이벤트를 고르고 Breakdown을 `memo`(또는 `memo_id`)로 둔 뒤 표로 보면 많이 나온 순으로 정렬된다. 노출 대비 열람 비율은 두 이벤트를 같은 Breakdown으로 놓고 Formula `B / A`로 본다.

## 푸시 퍼널

앱은 푸시로 화면을 열 때 `notification_id`, `notification_type` 쿼리를 붙인다([알림 명세](../../docs/product/specs/notifications.md) `POL-NOTIFICATION-017`). 웹은 `main.tsx`에서 이 쿼리가 있을 때만 `shared/lib/analytics/pushOpen.ts`를 따로 받아, 라우터가 주소를 읽기 전에 쿼리를 지우고 `push_opened`를 한 번 보낸다. 지운 주소로 바꿔 두므로 페이지뷰 경로에 남지 않고, 새로고침이나 뒤로 가기로 다시 기록되지 않는다. 이 모듈은 수집 초기화보다 먼저 실행되므로 초기화될 때까지 0.5초 간격으로 최대 20번 다시 시도한다.

| 이벤트                | 발생 시점                                                     | 추가 속성                                                |
| --------------------- | ------------------------------------------------------------- | -------------------------------------------------------- |
| `push_opened`         | 푸시로 연 첫 화면. 열 때마다 한 번                            | `notification_id`, `notification_type`(형식이 맞을 때만) |
| `weather_card_viewed` | 마이의 생활 날씨 카드가 오늘 예보를 그릴 때. 마운트마다 한 번 | 없음                                                     |

목표 행동은 알림 종류(`notification_type`)마다 다르다. 퍼널은 같은 사용자 기준으로 `push_opened`(종류로 거름) → 목표 행동을 본다. 발송 수는 DB 발송 기록에서 따로 센다.

| `notification_type` | 연 화면              | 목표 행동                                                            |
| ------------------- | -------------------- | -------------------------------------------------------------------- |
| `weather`           | 마이(`/me`)          | `weather_card_viewed`                                                |
| `delivery_coupon`   | 저렴한 한 끼 배달 탭 | `cheap_meal_detail_viewed`에서 `category = delivery`(배달 할인 상세) |

배달 할인에는 외부 링크가 없어 `cheap_meal_outbound_clicked`는 목표 행동으로 쓰지 않는다.

## 실패와 식별 처리

SDK 로딩 중 액션은 순서대로 큐에 넣는다. 일시적인 import/초기화 실패 후에는 큐를 보존하고 다음 수집 요청에서 재시도한다. 큐는 메모리 증가를 막기 위해 100개로 제한한다. SDK 액션 하나가 예외를 던져도 다른 액션과 제품 동작을 중단시키지 않는다. SDK 호출 자체가 실패한 이벤트는 무한 재전송하지 않는다.

수집 함수의 `true`는 SDK 호출 또는 큐 접수를 의미하며, 서버 수신 확인이 아니다. 토큰이 없거나 큐가 가득 찼거나 동기 SDK 호출이 실패하면 `false`다. ad blocker, 네트워크, 배포 설정 때문에 실제 수신이 누락되는 문제는 dev의 네트워크 요청과 PostHog 이벤트 수신을 별도로 대조해야 한다.

`getPostHogDiagnostics()`는 `disabled/loading/ready/failed`, 대기 액션 수, SDK 액션 실패 수, 큐 초과 거절 수를 반환한다. 네트워크 전송 실패를 확인하는 카운터는 아니다. development에서 실패 사유만 경고하며 토큰·사용자 입력·예외 원문을 출력하지 않는다. 진단 자체를 PostHog에 보내는 재귀 수집은 하지 않는다.

수동 기능 이벤트에 공통 속성을 직접 보강하고 `before_send`에서도 자동 수집·오류 이벤트를 보강한다. 속성 등록 실패나 reset으로 환경/버전이 빠지는 경우를 줄이고 호출부가 공통 값을 임의로 덮어쓰지 못하게 한다.

Access Token은 메모리에만 있어 새로고침 직후에는 늘 세션이 없다. 그래서 세션이 없다는 이유만으로 `reset()`하지 않고, 서버가 Refresh 쿠키로도 회원 복원을 거절해 인증이 끝났을 때만 reset한다. reset 뒤 환경·버전·플랫폼을 다시 등록한다. 같은 회원의 반복 identify는 생략한다. 자동 로그인은 페이지를 열고 처음 회원을 정할 때만 `login_succeeded`(`login_method: anonymous`, `new_member`)로, 실패는 `login_failed`로 남기고 토큰 갱신은 기록하지 않는다. 마이의 초기화는 성공하면 이전 회원 식별로 `account_reset_succeeded`를 남긴 뒤 reset하고, 이어지는 새 회원 로그인은 `login_succeeded`(`new_member: true`)로 남고, 새 회원은 회원 조회가 끝나면 다시 식별한다. 탈퇴 요청의 실패는 `account_reset_failed`(`error_kind`, `error_code`)로 남기며 식별은 그대로 둔다. 로그아웃도 초기화와 같은 순서로 `logout_succeeded` 뒤 reset하고, 실패는 `logout_failed`(`error_kind`, `error_code`)로 남긴다. OAuth 계정 연결은 `oauth_link_started`, `oauth_link_completed`(`outcome`), `oauth_link_cancelled`, `oauth_link_failed`(`reason`)로 남기고, 모두 `provider`와 그 시점 매물 수 `property_count`(알 때만)를 싣는다. 앱 네이티브 로그인 흐름은 같은 이벤트에 `flow: 'native'`를, 실패에는 `native_reason`을 더한다. 이벤트 이름과 속성 타입은 `features/auth/lib/oauthAnalytics.ts`에 둔다. 연결 뒤 바뀐 회원은 복귀 화면의 로그인이 `login_succeeded`로 남기고 회원 조회가 끝나면 다시 식별한다([OAuth 계정 연결](oauth-account-linking.md)).

오류 등급은 [에러 트래킹 문서](error-tracking.md)를 따른다. 이전 청크 삭제 정책은 그대로 유지한다.

auth_status는 발생 당시 로컬 인증 세션 상태를 나타내는 이벤트 속성이다. app이 인증 저장소 조회 함수를 수집 런타임에 주입하므로 shared가 auth 기능을 역참조하지 않는다. 수동 이벤트·스토어 이동·수동 예외는 큐 접수 전에 속성을 복사하고, 자동 수집은 before_send에서 보강한다. 회원 프로필이나 현재 로그인 상태로 과거 이벤트를 다시 분류하지 않는다.

기기·익명 테스트 트래픽 판정은 `deviceContext.ts`·`trafficContext.ts`가 소유한다. 일반 인앱 브라우저는 자취선배 앱이 아니며, 늦은 앱 브리지 주입은 등록 속성과 전송 직전 속성에 반영한다. 외부 스토어 CTA는 즉시 Beacon 전송을 시도한다. 자세한 판정 기준과 테스트 표시·필터 적용은 [탐색 측정 기준](exploration-analytics.md#수집-보강과-오류-경계)을 따른다.

## 성능과 화면 경로

`web-vitals`로 LCP, INP, CLS, FCP, TTFB를 재서 지표마다 `web_vital` 이벤트(`metric_name`, `metric_value`, `metric_rating`, `navigation_type`)로 보낸다. PostHog의 `capture_performance.web_vitals`는 TTFB가 없고 측정 스크립트를 PostHog 서버에서 따로 받으므로 쓰지 않는다. 측정 코드는 초기화 뒤 별도 청크로 받아 초기 번들을 늘리지 않는다. CLS와 INP는 화면을 숨길 때 확정되므로 Beacon으로 바로 보낸다.

모든 이벤트의 `before_send`가 `screen_route`(지금 화면의 라우트 패턴, `shared/lib/analytics/screenRoute.ts`)를 붙인다. 매물 번호, 동 코드, 쿼리는 싣지 않고 라우터에 없는 주소는 `*`로 묶는다. `web_vital`의 `screen_route`는 처음 연 화면이고, 값이 확정된 때의 화면은 `report_screen_route`다. 플랫폼(`platform`)과 트래픽 구분(`traffic_type`)은 다른 이벤트처럼 `before_send`가 붙인다.

## 검증

테스트는 `test/`에서 구현과 같은 디렉터리 구조를 따른다. SDK 큐·초기화 실패·전송 예외, 익명 방문·식별·로그아웃 공통 속성 복원, 플랫폼 분류, 매물 생성 성공/실패를 검증한다. React 연동은 최초 effect 이벤트, StrictMode, 지연된 설정 활성화까지 검증한다.

수정 후 `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`를 실행한다. dev 배포 후에는 `environment=development`로 비로그인 방문 → 로그인 → 매물 생성 → 로그아웃 → 재방문의 실제 수신을 확인한다. 로컬 자동화 테스트만으로 실제 PostHog 수신 완료를 선언하지 않는다.
