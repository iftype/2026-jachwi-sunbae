# 전국 날씨 수집 MVP

전국 예보를 미리 MySQL에 저장하고, 사용자 조회와 알림은 이 DB를 사용한다. 정기 알림의 지역은 회원의 마지막 저장 격자이며 [위치 저장 정책](weather-query.md#위치-저장조회삭제)을 따른다. 시간별 8개 요소와 일별 최저·최고기온을 수집하며, 발표 다음 정시부터 48시간을 유지한다.

## 스키마

[V3__create_weather_forecasts.sql](../../src/main/resources/db/migration/V3__create_weather_forecasts.sql)이 `weather_forecasts`, `weather_daily_forecasts`, `weather_collection_publications`를 생성한다. 적용된 V3는 보존하고 [V5](../../src/main/resources/db/migration/V5__simplify_weather_collection_metadata.sql)에서 `started_at`과 파서·계획에 중복된 세부 CHECK를 제거한다. PK와 격자 범위·시간 순서·일별 출처 조합 제약은 유지한다. 기존 날씨 버전이 적용된 DB에는 통합 파일을 그대로 적용하지 않는다. [적용 이력과 통합 정책](../operations/database-migrations.md)을 먼저 확인한다.

## 실행

`application-dev.yml`·`application-prod.yml`에서 `weather.collection.enabled=true`로 활성화하며 실행 환경에는 `KMA_API_KEY`를 주입한다. 공통·Local 설정은 OFF다. `WeatherCollectionScheduler`의 표준 `@Scheduled`가 KST 02:15·05:15·08:15·11:15·14:15·17:15·20:15·23:15에 실행한다. 15분은 실제 공개 지연을 측정하기 전의 초기 가정이며 cron과 발표분 선택 규칙에 고정했다.

빈 DB도 같은 수집 경로로 적재한다. 서버 시작 직후 적재, 최초 적재 검사·플래그, 수동 CLI는 없다. 첫 예약 수집이 끝나기 전에는 조회가 사용 불가를 반환하고 알림을 보내지 않는다. 서버 중단 중 놓친 예약은 보충하지 않는다.

## 클래스와 처리 흐름

| 클래스                                              | 역할                                                          |
| --------------------------------------------------- | ------------------------------------------------------------- |
| `WeatherCollectionScheduler`                        | KST 현재 시각으로 대상 발표분을 선택하고 서비스를 호출        |
| `WeatherPublicationSchedule`                        | 하루 8개 발표시각 검증과 15분 대기 기준의 최신 발표분 선택    |
| `WeatherCollectionPlan`                             | 48시간 × 8개 요소와 제공 가능한 TMN·TMX의 실제 요청 목록 생성 |
| `KmaForecastClient`, `KmaGridParser`                | HTTP 수신과 숫자 RAW 형식 검증                                |
| `HourlyForecastAssembler`, `DailyForecastAssembler` | 같은 격자·시각의 요소를 저장 모델로 결합                      |
| `WeatherCollectionService`                          | 요청 → 결합 → 저장 순서와 최소 완료 기록                      |
| `JdbcWeatherForecastRepository`                     | JDBC 배치 UPSERT, 완료 기록, 과거 예보 DELETE                 |

1. `collect(publishedAt)`이 계획을 만들고 해당 발표분의 `completed_at`을 비운다.
2. 한 예보시각의 TMP·SKY·PTY·POP·PCP·SNO·REH·WSD를 요청한다. HTTP·파싱·결합은 DB 트랜잭션 밖에서 실행한다.
3. 파서가 만든 37,697칸 `Double[]`를 그대로 받아 같은 인덱스의 8개 값을 결합한다. 별도 `GridValue` 목록은 없다. 그 시각의 TMP 유효 격자를 기준으로, 저장소의 `@Transactional upsertHourly`에서 전국 행을 배치 저장한다. 이 과정을 48번 반복한다.
4. 시간별로 사용한 격자의 날짜별 합집합에 TMN·TMX를 결합한다. TMP 유효 격자가 시각마다 달라질 수 있으므로 합집합을 유지하고, 일별 결합은 이 격자들만 읽는다. 날짜마다 `@Transactional upsertDaily`를 호출한다.
5. 모든 저장 메서드가 커밋된 뒤 발표분의 `completed_at`을 기록한다. 시작·종료 로그에는 발표시각, 성공 여부, 저장 입력 행 수를 남긴다. 같은 PK를 갱신한 행도 저장 입력 행 수에 포함한다.

`@Transactional`은 서비스가 호출하는 별도 저장소 빈의 공개 메서드에 있으므로 self-invocation으로 우회되지 않는다. 하나의 저장 단위에서 두 번째 JDBC 배치가 실패해도 첫 배치까지 롤백한다. 전체 48시간은 하나의 트랜잭션이 아니다.

## 유지한 데이터 계약

- RAW는 149 × 253 = 37,697개 숫자다. BOM·공백·줄바꿈·마지막 쉼표 하나를 허용하되 빈 셀·비정상 숫자·개수 불일치·전체 결측은 거부한다.
- 원본 인덱스는 `(ny - 1) * 149 + (nx - 1)`이다. 줄바꿈을 격자 행 경계로 보지 않는다.
- `-99`·`-999`는 결측이며 정상 0·음수 기온과 구분한다. 특정 TMP 샘플의 유효 격자 수를 고정하지 않는다.
- 필수 요소의 요청 실패는 수집 실패다. 실패를 NULL로 바꿔 성공 처리하지 않는다.
- 시간별 PK는 격자·예보시각, 일별 PK는 격자·날짜다. 이전 발표분은 최신 값을 덮어쓰지 않으며 동일 발표분의 정정은 반영한다. 일별 TMN·TMX는 각각의 발표·수집시각을 보존한다.
- 당일 TMN은 02시 발표까지, TMX는 11시 발표까지 요청한다. 날짜 경계·제공 시각은 요청 계획 테스트로 확인한다.
- 수집을 다시 시작하면 기존 완료 기록을 비우고, 조회는 발표분의 `completed_at IS NOT NULL`만 확인한다. 실패 전에 커밋한 일부 행은 DB에 남지만 정상 수치로 노출하지 않는다.

연결·읽기 제한시간은 클라이언트 상수인 3초·15초다. 키 없이 서버는 기동할 수 있지만 실제 수집은 실패한다. 요청 URL·인증키·RAW 오류 본문·외부 예외 cause는 로그에 남기지 않는다. 상세 성능 측정과 자동 재시도는 없다.

POP·PCP·SNO의 비0 값과 의미는 [RAW 계약 기록](weather-raw-contract.md)을 따른다. 검증되지 않은 숫자를 확률·강수량·적설량으로 임의 해석하지 않는다.

## 과거 예보 정리

`weather.cleanup.enabled=true`인 Dev·Prod에서는 `WeatherCleanupScheduler`가 매일 KST 00:30에 `WeatherCleanupService.cleanup()`을 호출한다. 한 번 읽은 시계에서 오늘 날짜를 계산하고, 같은 트랜잭션에서 `forecast_at < 오늘 00:00`과 `forecast_date < 오늘`을 삭제한다. 오늘·미래 자료는 보존한다.

전체 COUNT와 실행시간 측정 없이 두 DELETE의 영향 행 수만 로그에 남긴다. 분할 삭제·별도 인덱스·파티셔닝은 추가하지 않았다. 완료 기록과 알림 이력은 이 작업의 삭제 대상이 아니다.

## 검증과 한계

```bash
cd backend
./gradlew test --tests 'com.jachwisunbae.weather.*' --tests '*DatabaseBaselineIntegrationTest' --no-daemon
```

Docker의 MySQL을 사용한다. KMA HTTP는 모의 RAW로 검증하며 실제 외부 API를 호출하지 않는다. 기존 24시간 실험의 원본 검증 기록은 RAW 계약 문서에 남아 있지만 현재 48시간 전체의 실제 제공 지연을 확인한 결과는 아니다.

수집·정리·알림은 Spring의 기본 예약 실행기를 사용한다. 장시간 수집이 다른 예약을 지연시키는 문제, 다중 인스턴스 중첩, 실패한 발표분의 재처리·원자적 교체는 구현하지 않았다.
