# 생활 날씨 알림 MVP

기존 익명 회원 JWT와 마지막 동기화 격자를 사용한다. 회원당 앱 기기 하나를 등록하고, KST 07시에는 오늘 07–23시, 22시에는 내일 00–23시의 생활 날씨를 한 번 분석·발송한다. 모바일 위치·권한·FCM 토큰 획득·클릭 화면 연결은 후속 작업이다.

## 실행 흐름

1. 회원이 위치를 동기화하고 알림 수신에 동의한 뒤, OS 권한과 FCM 등록정보를 저장한다. 회원 동의는 기본 OFF다.
2. `WeatherNotificationScheduler`의 두 `@Scheduled` 메서드가 07시·22시에 각각 `WeatherNotificationDispatchService.dispatch(slot)`을 호출한다. 5분 간격 폴링이나 재시도는 없다.
3. 서비스를 통해 동의한 회원의 현재 등록 하나와 마지막 저장 격자를 확인한다. 위치 행이 없으면 발송하지 않으며 `updated_at`은 발송 조건에 사용하지 않는다. 앱을 오래 실행하지 않아도 저장된 격자를 그대로 사용한다.
4. `LifeWeatherAnalysisService`가 같은 지역 날씨 조회 서비스를 사용한다. 필요한 시간대의 TMP·PTY가 사용 가능하고 오전은 당일 05시, 저녁은 당일 20시 이상 발표분이어야 한다.
5. `LifeWeatherRules`가 조건을 충족한 생활 안내만 만들고 제목·본문을 선정한다. 전송할 수 있으면 `weather_notifications`에 격자·날짜·문구·`notices`를 저장한다.
6. 회원 × 발송일 × 슬롯의 유니크 키 INSERT에 성공한 호출만 발송한다. 직전에 동의·위치 존재 여부·기기 소유 및 토큰을 다시 확인하고 DB 트랜잭션 밖에서 FCM을 한 번 호출한다.
7. `SUCCESS` 또는 `FAILED`를 기록한다. `SUCCESS`는 FCM 요청 수락이며 휴대폰 도착 보장이 아니다. 앱은 푸시 `data.notificationId`로 본인의 당시 상세를 조회한다.

프로세스가 저장·호출·결과 기록 사이에 종료되면 `result=null`로 남을 수 있다. 별도 대기 상태나 복구 대상이 아니며 다시 전송하지 않는다. 실패·응답 유실도 재시도하지 않는다. Firebase SDK 내부 동작과 네트워크까지 포함해 기기에 정확히 한 번 도착하는 것을 보장하지 않는다.

알림 위치는 실시간 GPS가 아니라 판정 시작 시 조회한 마지막 저장 격자다. 이동·장기 미접속·OS 권한 철회를 서버가 자동으로 알아내지 못한다. 위치 DELETE 이후에는 저장 위치가 없어 발송을 건너뛰지만, 늦은 PUT이 오면 다시 등록된다. [위치 정책과 한계](weather-query.md#정기-알림의-위치-정책과-한계)를 따른다.

## 5가지 생활 안내

공식 기상특보나 실제 주택 위험을 확정하는 기준이 아닌 MVP 생활 안내다.

| 항목           | 사용 데이터 | 안내 조건                                                    |
| -------------- | ----------- | ------------------------------------------------------------ |
| 눈             | PTY         | 대상 시각 중 2(비/눈) 또는 3(눈)이 하나라도 있음             |
| 비             | PTY         | 대상 시각 중 1(비), 2(비/눈), 4(소나기)가 하나라도 있음      |
| 추위·동파 대비 | TMP·TMN     | 시간별 기온 또는 정상 일 최저기온이 -5℃ 이하                 |
| 일교차         | TMN·TMX     | 두 일별 값이 정상이고 최고 − 최저가 10℃ 이상                 |
| 빨래 추천      | PTY·REH     | 09–18시 10개 시각 모두 PTY=0이며 정상 습도의 평균이 60% 이하 |

빨래는 각 시각의 습도가 모두 60% 이하일 필요는 없다. 예를 들어 9시간이 50%, 1시간이 100%이면 평균 55%이므로 추천한다. 10개 시각 중 강수가 있거나 습도가 결측·범위 밖이면 추천을 생략한다. 예보상 참고 안내이며 실제 건조를 보장하지 않는다.

비·눈은 PTY만 사용한다. PTY=2이면 두 안내를 모두 만들고, PTY=0이면 POP·PCP·SNO 값이 높아도 비·눈 안내를 만들지 않는다. 건조·환기 안내와 강수확률 안내, 강수량·신적설량을 이용한 추가 판정·충돌 검사는 제공하지 않는다. 전국 10개 요소의 수집·저장·일반 날씨 조회는 그대로 유지한다. [RAW 데이터 계약](weather-raw-contract.md)은 수집·조회 계약이며 생활 안내 조건과 구분한다.

오전은 오늘 07–23시, 저녁은 내일 00–23시를 분석한다. 전체 대상 시각의 TMP·PTY가 정상이고 완료된 최신 예보라는 검증을 통과해야 한다. 시각 누락·중복이나 필수 값 결측이면 `sendable=false`, 제목·본문은 null, 안내 목록은 빈 목록으로 전체 알림을 만들지 않는다. TMN·TMX·REH 부족은 관련 안내만 생략하며 전체 알림을 막지 않는다.

`LifeWeatherForecast.Hour`는 시각·기온·강수형태·습도만 담는다. `LifeWeatherReport`는 `sendable`, `title`, `body`, `notices`만 가지며 각 `Notice`는 `condition`, `message`로 구성한다. 안내가 없는 조건을 정상 또는 판단 불가 상태로 별도 생성하지 않는다. **목록에 없다는 것은 안내가 생성되지 않았다는 뜻이며, 해당 날씨가 없다는 확정 판정이 아니다.**

메시지와 안내 목록은 **눈 → 비 → 추위·동파 → 일교차 → 빨래 추천** 순서다. 첫 주의를 제목으로, 두 번째 주의가 있으면 본문으로 사용한다. 주의가 없으면 빨래 추천을 제목으로 쓰고, 안내가 하나도 없으면 대상 시간대의 시간별 최저·최고 예보기온을 요약한다. 두 번째 주의가 없을 때의 본문은 마지막 확인 위치 기준이라는 고정 안내다. 오전·저녁마다 푸시는 각각 하나다.

- 비/눈과 추위가 함께 있으면 제목은 눈, 본문은 비이고 추위도 `notices`에 보존한다.
- 주의가 없고 빨래 조건을 만족하면 제목은 “오늘 09~18시 예보상 바깥 건조를 고려할 수 있어요”다.
- 안내가 없으면 “오늘 07~~23시 예보기온 5~~20℃”처럼 기온을 요약하고 `notices=[]`로 저장한다.

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

`WeatherNotification`은 ID·회원·발송일·슬롯·대상 날짜·격자·제목·본문·실제 안내 목록·단순 결과·생성시각을 가진다. JSON에는 `condition`, `message`만 가진 `List<Notice>`를 저장하며, 기온 요약 알림은 빈 배열을 저장한다. 예보 전체, 수집 출처, 정책 버전, 분석 당시 설정은 저장하지 않는다. 이후 위치나 원본 예보가 바뀌거나 정리되어도 당시 안내는 유지한다.

목록은 `GET /api/members/me/weather-notifications`, 상세는 `GET /api/members/me/weather-notifications/{notificationId}`다. 본인 자료만 접근하며 상세에 `result`를 반환한다. 수신 동의 API는 기존 `/api/members/me/weather-notification-settings`를 유지한다.

기존 계약에서 바뀐 부분:

- 상세의 `assessments`를 `notices`로 변경했다. 각 항목은 `condition`, `message`만 반환하며 `verdict`, `reason`, `forecastTimes`는 없다. 조건은 `SNOW`, `RAIN`, `FREEZE`, `TEMPERATURE_SWING`, `LAUNDRY` 다섯 개다. 목록 요약 DTO의 필드는 유지한다. 모바일 연동은 이 계약을 기준으로 구현한다.

- 기기 목록 및 설치 ID 경로를 현재 등록 하나의 `/weather-devices/current`로 교체했다. 설치 ID는 PUT 본문으로 이동했다.
- 수신·열람 보고 API를 삭제했다. 앱이 해당 요청을 보내면 안 된다.
- 상세의 `forecast`, `deliveries`, `policyVersion`, 분석 당시 설정, 위치 확인·준비·만료시각을 제거했다. 목록 생성시각은 `createdAt`이다.
- 기기별 상세 전송 상태 대신 단일 `result`를 반환한다. 앱 수신·열람 상태를 추적하지 않는다.

## 마이그레이션과 설정

[V4__create_weather_user_features.sql](../../src/main/resources/db/migration/V4__create_weather_user_features.sql)이 `member_weather_locations`, `member_weather_notification_settings`, `weather_notification_devices`, `weather_notifications`의 최종 MVP 구조를 처음부터 생성한다. 기기는 `UNIQUE(member_id)`와 토큰 해시 유니크 제약을, 알림은 회원·발송일·슬롯 유니크 제약을 유지한다. `notices`는 JSON, `result`는 `SUCCESS`·`FAILED` 또는 NULL이다.

2026-10-26 로컬 두 DB의 V4 미적용과 모든 영구 DB에 V4가 미적용이라는 담당자 확인을 근거로 V4의 알림 컬럼을 최종 `notices` 정의로 수정했다. 다른 테이블은 변경하지 않았다. 기존 DB 초기화·이력 수정이나 과거 JSON 변환 SQL은 실행하지 않았다. 통합 전 날씨 마이그레이션이 적용된 DB의 업그레이드 경로는 제공하지 않는다. [적용 이력과 통합 정책](../operations/database-migrations.md)을 확인하며, 다른 브랜치의 V3 충돌 조정은 별도 작업이다.

알림 실행 여부는 각 프로필의 `weather.notification.enabled`로 관리한다. Local은 OFF이며, Dev·Prod도 실제 Firebase 프로젝트가 미생성인 현재는 OFF다. 최종 목표는 Dev·Prod ON이다. 준비 후 각 YAML의 `firebase-project-id`에 서로 다른 실제 프로젝트 ID를 고정하고 활성화한다. OFF에서는 Firebase 자격증명을 읽지 않으며 ON에는 Google Application Default Credentials가 필요하다. 파일 기반 ADC이면 `GOOGLE_APPLICATION_CREDENTIALS`에 저장소 밖 경로를 넣는다.

Dev 서버·개발 앱·개발용 토큰은 Dev Firebase를, Prod 서버·운영 앱·운영용 토큰은 Prod Firebase를 사용한다. 서버 자격증명과 앱 설정의 프로젝트 일치를 확인하고 운영 토큰을 Dev DB에 복제하지 않는다. 회원 × 발송일 × 슬롯의 중복 생성 방지는 유지한다. [환경별 준비 사항](environment-variables.md#날씨의-외부-인증정보와-프로필)을 따른다.

Firebase Admin 연동은 유지하며 테스트에서는 전송 대역을 사용한다. Android TTL·APNs 만료는 요청부터 1시간으로 설정하지만 예약 누락·지연을 복구하지 않는다. 실기기 전송과 모바일 권한·토큰 갱신은 아직 검증하지 않았다.
