# 전국 날씨 데이터 수집

전국 단기예보 격자자료의 HTTP 수신·RAW 파싱·모델·저장 스키마와 JDBC 배치 UPSERT를 설명한다. 현재는 요소 한 개의 전국 자료를 요청하고 검증할 수 있으며, 결합된 시간별·일별 예보를 저장할 수 있다. 요소 결합·수집 명령·자동 실행은 후속 작업에서 연결한다.

## HTTP 클라이언트

`KmaForecastClient.fetch(times, element)`는 기상청 `nph-dfs_shrt_grd`에 `tmfc`, `tmef`, `vars`, `authKey`를 담은 GET 요청을 보내고, `KmaGridParser`로 검증한 `GridForecast`를 반환한다. `Accept: text/plain`으로 요청하고 숫자 RAW 본문은 UTF-8로 읽는다.

```java
ForecastTimes times = ForecastTimes.parse("2026102223", "2026102300");
GridForecast forecast = kmaForecastClient.fetch(times, WeatherElement.TMP);
```

인증키만 `KMA_API_KEY` 환경변수로 주입한다. 기본값은 비어 있으며 개인 `.env`나 서버의 비밀값 설정으로 관리한다. 연결 제한시간 3초와 읽기 제한시간 15초는 `KmaForecastClient`의 `CONNECT_TIMEOUT`, `READ_TIMEOUT` 상수로 관리한다.

`KmaForecastClient`는 항상 빈으로 등록된다. 인증키 없이도 애플리케이션이 기동되며, 실제 `fetch` 호출 시 키가 비어 있으면 네트워크 요청 전에 설정 오류로 거부한다. 빈 생성만으로 요청을 보내지 않는다. 자동 수집·초기 적재·삭제 실행 플래그는 이후 해당 기능에서 별도로 추가한다.

HTTP 200 이외의 상태는 `WEATHER_PROVIDER_UNAVAILABLE`로 처리하고 디버깅 메시지에 상태 코드만 남긴다. 연결 실패·시간 초과·본문 읽기 실패도 외부 시스템 오류로 처리하되 HTTP 상태 오류와 다른 메시지로 구분한다. HTTP 200의 빈 본문·오류 본문·불완전한 격자는 파서가 `WEATHER_RESPONSE_INVALID`로 거부한다.

인증키는 URI 변수로 인코딩하며 리다이렉트를 따라가지 않는다. 요청 URL·오류 본문·외부 예외 메시지는 인증키를 포함할 수 있어 로그와 예외에 전달하지 않는다. 원인 예외도 같은 이유로 연결하지 않는다. 현재 클라이언트는 재시도를 수행하지 않으며 재처리 정책은 후속 작업에서 다룬다.

## 모델과 파서

| 클래스             | 역할                                                |
| ------------------ | --------------------------------------------------- |
| `WeatherElement`   | 수집 대상 10개 요소의 API 식별자                    |
| `ForecastTimes`    | KST 발표시각과 예보대상시각, `tmfc`·`tmef` 변환     |
| `GridPoint`        | 1부터 시작하는 격자 좌표와 원본 인덱스 변환         |
| `GridValue`        | 결측을 제외한 격자 한 곳의 원본 숫자                |
| `GridForecast`     | 요청 시각·기상 요소·유효 격자 목록과 유효·결측 개수 |
| `KmaGridParser`    | 응답 구조 검증, 숫자 파싱과 결측 제외               |
| `HourlyForecast`   | 같은 격자·발표·대상 시각의 시간별 8개 값과 수집시각 |
| `DailyTemperature` | 일별 기온 한 요소의 값·발표시각·수집시각            |
| `DailyForecast`    | 같은 격자·대상 날짜의 TMN·TMX 수집 결과             |

파서는 Spring·HTTP·DB에 의존하지 않는다. RAW 본문에는 발표시각·예보대상시각·요소가 없으므로 호출자가 실제 요청에 사용한 메타데이터를 전달해야 한다.

```java
ForecastTimes times = ForecastTimes.parse("2026102214", "2026102217");
GridForecast forecast = new KmaGridParser().parse(raw, times, WeatherElement.TMP);
```

`ForecastTimes`의 `LocalDateTime`은 KST 현지 시각이다. JVM 기본 시간대로 변환하지 않으며, 유효한 날짜·시간 단위·발표와 예보시각의 순서를 검증한다. 하루 8개 발표시각 선택과 요소별 제공 시각은 수집 계획에서 다룬다.

## RAW 파싱 규칙

- 쉼표로 구분된 값이 정확히 149 × 253 = 37,697개여야 한다. BOM, 값 주변 공백·줄바꿈, 마지막 쉼표 한 개를 허용한다.
- `index`는 결측을 포함한 원본의 0 기반 인덱스다. `nx = index % 149 + 1`, `ny = index / 149 + 1`로 계산한다. 물리적인 줄바꿈은 격자 행 경계가 아니다.
- `(1, 1)`은 첫 값, `(149, 1)`은 149번째 값, `(1, 2)`는 150번째 값이다. 마지막 값은 `(149, 253)`에 대응한다.
- `-99`·`-999`는 결과 목록에서 제외한다. 정상 0과 음수는 보존하며, 결측을 제거해도 이후 값의 좌표가 바뀌지 않는다.
- 결과 목록은 변경할 수 없다. 유효 격자 수는 응답마다 다르며 TMP의 특정 샘플 개수를 고정하지 않는다.
- 빈 응답·값 개수 불일치·빈 셀·숫자가 아닌 값·NaN/Infinity·전체 결측은 `UpstreamServiceException`과 `WEATHER_RESPONSE_INVALID`로 거부한다. 응답 원문과 원문을 포함하는 파싱 예외는 로그에 노출되지 않도록 예외 메시지·cause에 넣지 않는다.
- 파서는 숫자 구조를 검증하고 원본 숫자를 보존한다. 단위 환산·범주 해석·코드 범위 제한은 수행하지 않는다. 요소별 근거와 미확인 항목은 [10개 기상 요소의 RAW 파싱 계약](weather-raw-contract.md)을 따른다.

격자 인덱스와 샘플 값의 일치를 검증한 것이며, 실제 매물의 위경도 변환 검증은 조회 기능 작업에서 진행한다.

## 날씨 저장 스키마

`V3__create_weather_forecasts.sql`이 두 테이블을 생성한다. 기존 V1·V2는 수정하지 않으며 마이그레이션에서 날씨 데이터를 적재하거나 API를 호출하지 않는다.

| 테이블                    | 한 행의 기준 / 기본키             | 저장 요소                       |
| ------------------------- | --------------------------------- | ------------------------------- |
| `weather_forecasts`       | `(grid_x, grid_y, forecast_at)`   | TMP·SKY·PTY·POP·PCP·SNO·REH·WSD |
| `weather_daily_forecasts` | `(grid_x, grid_y, forecast_date)` | TMN·TMX                         |

발표시각은 기본키에 포함하지 않는다. 같은 격자·대상 시각에 대한 최신 예보를 갱신하는 구조이며 발표 이력을 모두 보관하는 구조는 아니다. 날씨 격자는 매물과 독립적이므로 매물 외래 키나 별도 자동 증가 ID를 두지 않는다.

### 시간별 예보

| 컬럼               | 자료형 / NULL                | 의미                                                  |
| ------------------ | ---------------------------- | ----------------------------------------------------- |
| `grid_x`, `grid_y` | `SMALLINT UNSIGNED NOT NULL` | x는 1부터 149, y는 1부터 253인 1 기반 격자 좌표       |
| `forecast_at`      | `DATETIME NOT NULL`          | KST 예보대상시각, 정시                                |
| `published_at`     | `DATETIME NOT NULL`          | 시간별 8개 요소에 공통인 KST 발표시각, 정시           |
| `tmp`              | `DOUBLE NULL`                | 원본 기온, ℃                                          |
| `sky`, `pty`       | `DOUBLE NULL`                | 원본 하늘상태·강수형태 코드                           |
| `pop`              | `DOUBLE NULL`                | POP 원본 숫자. 강수확률 의미는 추가 확인 필요         |
| `pcp`, `sno`       | `DOUBLE NULL`                | 강수량·신적설 원본 숫자. 비0 값의 mm·cm 대응은 미확인 |
| `reh`, `wsd`       | `DOUBLE NULL`                | 원본 상대습도(%), 풍속(m/s)                           |
| `collected_at`     | `DATETIME(6) NOT NULL`       | 해당 행에 반영한 수집 결과의 KST 수집시각             |

기상 값은 파서의 Java `double`에 대응하는 `DOUBLE`로 보관한다. 현재 단계에서는 정수 코드로 강제 변환하거나 소수 자릿수를 고정해 원본 숫자를 반올림하지 않는다. 표시용 정수·범주·단위 환산은 [RAW 계약](weather-raw-contract.md)을 확인한 뒤 수행한다.

정상 응답에서 특정 격자가 결측이면 해당 요소를 `NULL`로 저장한다. 실제 0과 음수 기온은 그대로 저장하며 원본 결측 코드 `-99`·`-999`를 직접 저장하면 CHECK 제약으로 거부한다. SKY·PTY 코드 범위와 미확인 변수의 물리 범위는 DB에서 추가 제한하지 않는다. 요청 실패를 정상 결측으로 바꾸는 것은 허용하지 않으며 후속 수집 서비스가 이를 구분해야 한다.

### 일별 기온

| 컬럼                                   | 자료형 / NULL                | 의미                          |
| -------------------------------------- | ---------------------------- | ----------------------------- |
| `grid_x`, `grid_y`                     | `SMALLINT UNSIGNED NOT NULL` | 시간별 예보와 같은 격자 좌표  |
| `forecast_date`                        | `DATE NOT NULL`              | KST 예보대상일                |
| `tmn`, `tmx`                           | `DOUBLE NULL`                | 원본 일 최저·최고기온, ℃      |
| `tmn_published_at`, `tmx_published_at` | `DATETIME NULL`              | 각 요소의 KST 발표시각, 정시  |
| `tmn_collected_at`, `tmx_collected_at` | `DATETIME(6) NULL`           | 각 요소에 반영한 KST 수집시각 |

TMN·TMX는 제공 시각이 다르고 한 요소만 갱신할 수 있으므로 출처 시각을 요소별로 둔다. 예를 들어 TMX를 더 최신 발표분으로 갱신해도 기존 TMN의 발표시각을 함께 바꾸지 않는다. 최저·최고 값을 같은 발표분이라고 가정하는 `tmn <= tmx` 제약은 두지 않는다.

- 값·발표시각·수집시각이 모두 `NULL`: 해당 요소를 아직 반영하지 않음. 계획상 미제공일 수 있다.
- 값은 `NULL`, 발표·수집시각은 존재: 정상 응답에서 해당 격자가 결측이었음.
- 값이 0, 발표·수집시각은 존재: 실제 0℃ 예보.
- 값이 존재하면 발표·수집시각도 필요하다. 발표·수집시각 중 하나만 저장할 수 없고, 양쪽 요소 모두 미수집인 빈 행도 만들 수 없다.

요청 실패 이력을 이 테이블의 `NULL`로 표현하지 않는다. 응답 결측과 계획상 미제공을 구분할 수 있도록 후속 저장소는 값과 해당 요소의 출처 시각을 함께 갱신해야 한다.

### 시각·갱신·인덱스 기준

모든 시각은 KST `LocalDateTime`으로 전달한다. `DATETIME` 자체는 시간대를 저장하지 않으며 DB 세션 시간대에 의존하는 `CURRENT_TIMESTAMP` 기본값이나 자동 갱신 설정도 두지 않는다. 수집시각은 마이크로초까지 저장한다.

시간별 예보는 `forecast_at >= published_at`, 일별 기온은 각 발표일이 `forecast_date` 이하인지 검사한다. 발표·시간별 예보시각의 분·초는 0이어야 한다. 하루 8개 발표시각 선택과 TMN·TMX의 제공 시각은 수집 계획에서 검증한다.

최신성 비교는 시간별 행의 `published_at`, 일별 요소 각각의 `*_published_at`을 기준으로 JDBC 저장소의 UPSERT에서 수행한다. 더 최신 발표분과 같은 발표시각의 정정·재수집을 반영할 때 수집시각도 갱신하며, 과거 발표분을 무시할 때는 기존 수집시각도 유지한다. DB에 직접 UPDATE하면 이 보호가 적용되지 않는다.

기본키는 격자별 시각·날짜 조회를 지원한다. 보존기간 정리를 위한 시간 선두 인덱스나 추가 조회 인덱스는 실제 조회·삭제 비용을 측정한 뒤 추가한다.

## JDBC 배치 UPSERT

`JdbcWeatherForecastRepository`는 `JdbcTemplate.batchUpdate`로 최대 1,000행씩 실행한다. `upsertHourly(List<HourlyForecast>)`와 `upsertDaily(List<DailyForecast>)`를 제공하고 빈 목록은 아무 작업도 하지 않는다. 목록과 행은 null일 수 없으며, 입력 목록의 null 행은 쓰기 전에 거부한다.

입력 모델은 필수 메타데이터, 유한한 숫자, `-99`·`-999` 금지를 생성 시 검증한다. `HourlyForecast`는 8개 요소가 같은 발표·대상 시각에 속한다고 가정한다. 실제 `GridForecast`들을 검증하고 결합하는 과정은 후속 수집 서비스에서 구현한다.

| 입력과 기존 발표시각의 관계 | 반영 결과                             |
| --------------------------- | ------------------------------------- |
| 기본키에 해당하는 행 없음   | 새 행 삽입                            |
| 입력이 더 최신              | 값·발표시각·수집시각 갱신             |
| 발표시각 같음               | 정정·재수집으로 보고 값·수집시각 갱신 |
| 입력이 과거                 | 기존 값·발표시각·수집시각 모두 유지   |

비교는 사전 SELECT 없이 `INSERT ... ON DUPLICATE KEY UPDATE` 안에서 수행한다. 입력 행은 `AS incoming` 별칭으로 참조한다. 이 방식은 [MySQL 8.4의 행 별칭 문법](https://dev.mysql.com/doc/refman/8.4/en/insert-on-duplicate.html)을 사용하며, 폐기 예정인 `VALUES(column)` 함수는 사용하지 않는다. 값·수집시각을 비교한 뒤 발표시각을 마지막에 갱신한다.

동일 발표시각은 나중에 저장한 입력을 반영하며, `collected_at`을 추가적인 최신성 조건으로 쓰지 않는다. 수집시각은 호출자가 전달한 KST 시각을 저장한다. 최신·동일 발표분의 정상 결측은 기존 숫자를 `NULL`로 바꾸고, 반대로 정상 0은 기존 `NULL`을 0으로 바꾼다.

일별 입력은 다음처럼 구분한다.

- `DailyForecast.tmn()` 또는 `tmx()`가 `null`: 해당 요소를 이번에 수집하지 않았으므로 기존 세 컬럼을 모두 유지한다.
- `DailyTemperature.value()`가 `null`: 정상 응답의 결측이다. 해당 요소의 발표시각이 최신·동일이면 값은 `NULL`로, 출처 시각은 입력값으로 갱신한다.
- 기존 일별 행에 한 요소만 있으면 다른 요소를 나중에 채울 수 있다. 상대 요소의 발표시각과는 비교하지 않는다.

예를 들어 아래 호출은 TMN의 결측 결과만 반영하고 기존 TMX는 유지한다.

```java
DailyTemperature minimum = new DailyTemperature(null, publishedAt, collectedAt);
DailyForecast forecast = new DailyForecast(point, forecastDate, minimum, null);
repository.upsertDaily(List.of(forecast));
```

저장소는 호출자가 연 Spring 트랜잭션에 참여하며 별도 트랜잭션을 시작하거나 커밋하지 않는다. 트랜잭션이 없으면 자동 커밋 설정에 따라 앞서 실행한 배치가 남을 수 있다. 후속 수집 서비스가 저장 단위의 트랜잭션 경계를 정해야 하며, 현재 구현이 발표분 전체의 원자적 갱신·실패 재시도를 보장하지는 않는다. DB 오류는 숨기지 않고 호출자에게 전달한다.

MySQL의 영향받은 행 수는 INSERT·UPDATE 여부와 드라이버 설정에 따라 다르므로 메서드는 삽입·갱신 건수로 환산한 값을 반환하지 않는다. 테스트는 실제 저장된 행과 값을 조회해 검증한다. JDBC URL의 `rewriteBatchedStatements` 설정은 변경하지 않았으며, 테스트는 OFF·ON 모두에서 같은 결과를 확인한다.

## 테스트와 실제 샘플 확인

`backend`에서 실행한다. 클라이언트·모델·파서 단위 테스트는 코드로 생성한 격자 데이터, 실제 RAW에서 발췌한 소형 CSV, `MockRestServiceServer`의 가짜 HTTP 응답을 사용하므로 실제 API 키·네트워크·DB·외부 원본 파일이 필요 없다. 인증키 유무에 따른 기동과 키가 없는 상태의 요청 거부도 확인한다.

```bash
./gradlew test --tests 'com.jachwisunbae.weather.client.*' \
  --tests 'com.jachwisunbae.weather.domain.*' --tests 'com.jachwisunbae.weather.parser.*' --no-daemon
```

`WeatherSchemaIntegrationTest`, `JdbcWeatherForecastRepositoryTest`, `DatabaseBaselineIntegrationTest`는 Testcontainers의 MySQL 8.4.10을 사용하므로 Docker가 필요하다. 개인 로컬 DB 대신 별도 컨테이너에서 마이그레이션, 기본키·CHECK 제약, UPSERT 최신성·정정, NULL·0과 시각 보존, 1,001행 배치·재실행, 호출자 트랜잭션의 롤백을 확인한다. 저장소 테스트는 DB 세션을 UTC로 설정해도 KST `LocalDateTime`이 변환되지 않는지 검사한다. SQL 변경 후에는 인수 테스트를 포함한 전체 검사도 실행한다.

```bash
./gradlew test --tests 'com.jachwisunbae.weather.database.*' \
  --tests 'com.jachwisunbae.weather.repository.*' \
  --tests 'com.jachwisunbae.common.database.DatabaseBaselineIntegrationTest' --no-daemon
./gradlew testAll --no-daemon
```

로컬 실험의 `2026102214_2026102217_TMP.raw`를 사용할 때의 대조 기준은 다음과 같다. 원본은 저장소 밖에 보관하며 Git에 추가하지 않는다.

| 항목               | 값                                                                 |
| ------------------ | ------------------------------------------------------------------ |
| SHA-256            | `59ca905065de108ebd5884f4080625ad828103f7c78bc3aa187a0052c8f5ddf0` |
| 전체 / 유효 / 결측 | 37,697 / 9,295 / 28,402                                            |
| 유효값 범위        | -4~19℃                                                             |
| `(60, 127)`        | 14℃                                                                |

컴파일 후 `jshell --class-path build/classes/java/main`에서 원본 파일을 `Files.readString`으로 읽고 위 예제의 메타데이터로 파싱하면 `validCount()`, `missingCount()`, `values()`로 대조할 수 있다. 이 값은 해당 샘플의 재현 기준이며 다른 발표분·요소에 적용하는 제약이 아니다.

## 실험 코드 이관 범위

`codex/weather-lab`의 `ForecastTimes`, `GridTemperature`, `KmaGridParser`를 출발점으로 시각 모델과 파싱 규칙을 이관했다. 기온에 묶여 있던 값은 `GridValue`와 `WeatherElement`로 분리하고, 실험용 기온 컬럼의 저장 범위 제한은 공통 숫자 파서에 적용하지 않는다.

실험용 `fetchTmp`는 요소를 인자로 받는 `KmaForecastClient.fetch`로 확장했다. 정상 HTTP 상태만으로 성공을 판단하지 않고 파싱을 통과한 자료를 반환한다. 실험용 Runner·고정 시각·Compose·프로필·DB 마이그레이션과 저장소는 이관하지 않았으며, 애플리케이션 기동만으로 외부 호출이나 데이터 적재가 실행되지 않는다.

## 참고 자료

- [기상청 API허브 — 전국 단기예보 격자자료](https://apihub.kma.go.kr/apiList.do?seqApi=10&seqApiSub=286)
- [기상기후데이터위키 — 배열 크기와 RAW 처리 예제](https://datawiki.kma.go.kr/doku.php?id=%EA%B8%B0%EC%83%81%EC%98%88%EB%B3%B4:%EB%82%A0%EC%94%A8%EC%98%88%EB%B3%B4:%EB%8B%A8%EA%B8%B0%EC%98%88%EB%B3%B4)
- [전국 날씨 수집 구현 이슈 #431](https://github.com/woowacourse-teams/2026-jachwi-sunbae/issues/431)
