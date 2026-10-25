# 생활 날씨 알림 MVP

기존 익명 회원 JWT와 마지막 동기화 격자를 사용한다. 회원당 앱 기기 하나를 등록하고, KST 07시에는 오늘 07–23시, 22시에는 내일 00–23시의 생활 날씨를 한 번 분석·발송한다. 모바일 위치·권한·FCM 토큰 획득·클릭 화면 연결은 후속 작업이다.

## 실행 흐름

1. 회원이 위치를 동기화하고 알림 수신에 동의한 뒤, OS 권한과 FCM 등록정보를 저장한다. 회원 동의는 기본 OFF다.
2. `WeatherNotificationScheduler`의 두 `@Scheduled` 메서드가 07시·22시에 각각 `WeatherNotificationDispatchService.dispatch(slot)`을 호출한다. 5분 간격 폴링이나 재시도는 없다.
3. 서비스를 통해 동의한 회원의 현재 등록 하나와 마지막 저장 격자를 확인한다. 위치 행이 없으면 발송하지 않으며 `updated_at`은 발송 조건에 사용하지 않는다. 앱을 오래 실행하지 않아도 저장된 격자를 그대로 사용한다.
4. `LifeWeatherAnalysisService`가 같은 지역 날씨 조회 서비스를 사용한다. 필요한 시간대의 TMP·PTY가 사용 가능하고 오전은 당일 05시, 저녁은 당일 20시 이상 발표분이어야 한다.
5. `LifeWeatherRules`가 7개 결과와 통합 문구를 만든다. 전송할 수 있으면 `weather_notifications`에 격자·날짜·문구·7개 판정을 저장한다.
6. 회원 × 발송일 × 슬롯의 유니크 키 INSERT에 성공한 호출만 발송한다. 직전에 동의·위치 존재 여부·기기 소유 및 토큰을 다시 확인하고 DB 트랜잭션 밖에서 FCM을 한 번 호출한다.
7. `SUCCESS` 또는 `FAILED`를 기록한다. `SUCCESS`는 FCM 요청 수락이며 휴대폰 도착 보장이 아니다. 앱은 푸시 `data.notificationId`로 본인의 당시 상세를 조회한다.

프로세스가 저장·호출·결과 기록 사이에 종료되면 `result=null`로 남을 수 있다. 별도 대기 상태나 복구 대상이 아니며 다시 전송하지 않는다. 실패·응답 유실도 재시도하지 않는다. Firebase SDK 내부 동작과 네트워크까지 포함해 기기에 정확히 한 번 도착하는 것을 보장하지 않는다.

알림 위치는 실시간 GPS가 아니라 판정 시작 시 조회한 마지막 저장 격자다. 이동·장기 미접속·OS 권한 철회를 서버가 자동으로 알아내지 못한다. 위치 DELETE 이후에는 저장 위치가 없어 발송을 건너뛰지만, 늦은 PUT이 오면 다시 등록된다. [위치 정책과 한계](weather-query.md#정기-알림의-위치-정책과-한계)를 따른다.

## 7가지 규칙

임계값은 기존 초기 생활 안내 정책을 유지했다. 공식 기상특보나 실제 주택 위험을 확정하는 기준이 아니다.

| 항목        | 조건                                                                     |
| ----------- | ------------------------------------------------------------------------ |
| 비          | PTY 1·2·4. PTY·PCP·SNO가 모두 0인 시각의 POP 60% 이상은 강수 가능성 안내 |
| 눈          | PTY 2·3                                                                  |
| 수도관 보온 | TMP 또는 TMN이 -5℃ 이하                                                  |
| 일교차      | 정상 일별 TMX − TMN이 10℃ 이상                                           |
| 건조        | 대상 시각 중 REH 35% 이하                                                |
| 빨래        | 09–18시 모두 PTY·PCP·SNO 0, POP 30 이하, REH 60 이하, WSD 1–7            |
| 환기        | 10–17시 중 PTY·PCP·SNO 0, REH 40–70, WSD 5 이하, TMP 5–28인 시각         |

주요 주의 문구는 **눈 → 비 → 수도관 보온 → 일교차** 순서로 제목 하나·본문 추가 하나까지 선정한다. 건조와 빨래 주의는 상세에 보존하며 주요 주의 제목으로 선정하지 않는다. 주요 주의가 없으면 빨래·환기 추천을 사용하고, 추천도 없으면 해당 시간 구간의 기온 요약을 제공한다. 환기는 실외 공기질을 별도로 확인하도록 안내한다.

상세의 `CAUTION / RECOMMENDED / NOT_APPLICABLE / UNKNOWN` 구분은 유지한다. 결측·잘못된 값·필수 시간대 누락을 정상이나 추천으로 바꾸지 않는다.

POP는 강수확률(%), PCP는 1시간 강수량(mm), SNO는 1시간 신적설(cm)로 해석한다. [공식 문서와 실제 비·눈 RAW 검증](weather-raw-contract.md#강수-계약-추가-검증2026-10-25)을 근거로 임시 검증 플래그를 제거했다. 정상 0과 결측은 구분한다.

PTY의 비·눈 형태가 우선이다. PCP·SNO가 0이어도 PTY의 비·눈 주의를 유지하고, PTY=2는 두 형태 모두 안내한다. PTY=3의 높은 POP로 비 주의를 추가하지 않는다. PTY=3이면 PCP가 양수여도 비 주의를 추가하지 않는다. PTY=0인데 양수 강수량·신적설량이 있거나, 비·소나기 형태인데 신적설량이 양수이면 해당 형태를 임의로 생성하지 않고 `UNKNOWN`으로 둔다. 필수 PTY가 없으면 보조 값으로 형태를 추정하지 않는다. POP 임계값 안내는 형태·양이 모두 무강수인 시각에 한해 기존의 시각별 강수확률 문구를 사용한다.

빨래·환기는 검증 설정 없이 기존 시간대·임계값으로 추천한다. PTY가 강수이면 양이 0이어도 무강수로 보지 않는다. 환기는 공기질의 안전을 보장하지 않는다. 실제 샘플 회귀 테스트는 한 격자·시각의 네 강수 요소를 합성 시간대에 넣으며, 실제 하루 전체 예보의 검증을 뜻하지 않는다.

## 회원당 하나의 기기 등록

`GET / PUT / DELETE /api/members/me/weather-devices/current`가 현재 등록 하나를 다룬다. 미등록 조회는 `data=null`이다. 등록 요청은 `installationId`, `installationSecret`, `token`, `platform`, `permission`이며 Swagger/OpenAPI를 공개 계약으로 사용한다.

- 기존 익명 회원 JWT로 본인 등록을 갱신하거나 해제한다. 새로운 설치를 등록하면 그 회원의 이전 설치 등록을 교체한다. DB의 `UNIQUE(member_id)`가 등록 하나를 보장한다.
- 설치 ID는 UUID, 설치 비밀키는 최소 32바이트 난수를 Base64url로 인코딩한 43–128자다. 앱은 익명 인증 초기화와 별도로 둘을 보관하고 서버는 비밀키의 SHA-256 해시만 저장한다.
- 같은 설치를 새 익명 회원에게 연결하려면 기존 설치 비밀키가 일치해야 한다. 토큰 문자열 일치만으로 소유권을 이전하지 않는다. 토큰 해시의 유니크 제약 충돌은 등록 실패이며 이전 데이터를 롤백한다.
- 이전된 설치는 이전 회원 조회에서 사라지고 이전 회원의 동의는 새 회원으로 복사하지 않는다. OS 권한 `DENIED`와 해지는 토큰을 지우고 비활성화한다.
- 등록 변경·소유 확인은 짧은 트랜잭션에서 처리한다. 버전 카운터·활성 기기 수 제한·기기별 전송 큐는 없다.
- FCM 요청 직전에 현재 등록을 다시 확인한다. 확인 직후 변경되거나 이미 FCM에 전달된 푸시를 회수하는 문제까지 해결하지 않는다. 앱은 현재 JWT로 접근할 수 없는 과거 회원의 알림 상세를 표시하지 않아야 한다.

토큰·설치 비밀키·해시는 응답에 포함하지 않는다. 토큰 자체는 FCM 호출을 위해 DB에 필요하지만 요청 본문·원문 예외·개인 위치와 함께 로그에 출력하지 않는다.

## 이력과 API 변경

`WeatherNotification`은 ID·회원·발송일·슬롯·대상 날짜·격자·제목·본문·7개 판정·단순 결과·생성시각을 가진다. JSON에는 판정 목록만 저장한다. 예보 전체, 수집 출처, 정책 버전, 분석 당시 설정은 저장하지 않는다. 이후 위치나 원본 예보가 바뀌거나 정리되어도 당시 판정은 유지한다.

목록은 `GET /api/members/me/weather-notifications`, 상세는 `GET /api/members/me/weather-notifications/{notificationId}`다. 본인 자료만 접근하며 상세에 `result`를 반환한다. 수신 동의 API는 기존 `/api/members/me/weather-notification-settings`를 유지한다.

기존 계약에서 바뀐 부분:

- 기기 목록 및 설치 ID 경로를 현재 등록 하나의 `/weather-devices/current`로 교체했다. 설치 ID는 PUT 본문으로 이동했다.
- 수신·열람 보고 API를 삭제했다. 앱이 해당 요청을 보내면 안 된다.
- 상세의 `forecast`, `deliveries`, `policyVersion`, 분석 당시 설정, 위치 확인·준비·만료시각을 제거했다. 목록 생성시각은 `createdAt`이다.
- 기기별 상세 전송 상태 대신 단일 `result`를 반환한다. 앱 수신·열람 상태를 추적하지 않는다.

## 마이그레이션과 설정

[V4__create_weather_user_features.sql](../../src/main/resources/db/migration/V4__create_weather_user_features.sql)이 `member_weather_locations`, `member_weather_notification_settings`, `weather_notification_devices`, `weather_notifications`의 최종 MVP 구조를 처음부터 생성한다. 기기는 `UNIQUE(member_id)`와 토큰 해시 유니크 제약을, 알림은 회원·발송일·슬롯 유니크 제약을 유지한다. `assessments`는 JSON, `result`는 `SUCCESS`·`FAILED` 또는 NULL이다.

기기 등록 버전·전송 작업 테이블·전체 예보 스냅샷을 생성하거나 과거 JSON을 변환하는 중간 SQL은 없다. 통합 전 날씨 마이그레이션이 적용된 DB의 업그레이드 경로는 제공하지 않는다. [적용 이력과 통합 정책](../operations/database-migrations.md)을 확인하며, 다른 브랜치의 V3 충돌 조정은 별도 작업이다.

알림 실행 여부는 각 프로필의 `weather.notification.enabled`로 관리한다. Local은 OFF이며, Dev·Prod도 실제 Firebase 프로젝트가 미생성인 현재는 OFF다. 최종 목표는 Dev·Prod ON이다. 준비 후 각 YAML의 `firebase-project-id`에 서로 다른 실제 프로젝트 ID를 고정하고 활성화한다. OFF에서는 Firebase 자격증명을 읽지 않으며 ON에는 Google Application Default Credentials가 필요하다. 파일 기반 ADC이면 `GOOGLE_APPLICATION_CREDENTIALS`에 저장소 밖 경로를 넣는다.

Dev 서버·개발 앱·개발용 토큰은 Dev Firebase를, Prod 서버·운영 앱·운영용 토큰은 Prod Firebase를 사용한다. 서버 자격증명과 앱 설정의 프로젝트 일치를 확인하고 운영 토큰을 Dev DB에 복제하지 않는다. 회원 × 발송일 × 슬롯의 중복 생성 방지는 유지한다. [환경별 준비 사항](environment-variables.md#날씨의-외부-인증정보와-프로필)을 따른다.

Firebase Admin 연동은 유지하며 테스트에서는 전송 대역을 사용한다. Android TTL·APNs 만료는 요청부터 1시간으로 설정하지만 예약 누락·지연을 복구하지 않는다. 실기기 전송과 모바일 권한·토큰 갱신은 아직 검증하지 않았다.
