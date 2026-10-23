# 전국 날씨 데이터 수집

전국 단기예보 격자자료의 HTTP 수신·RAW 파싱·수집 계획·시간별 및 일별 결합·JDBC 배치 UPSERT와 수동 실행을 설명한다. 명시한 발표분의 24시간 예보와 해당 날짜의 일별 기온을 한 번 수집해 저장할 수 있다. 최신 발표분 선택·최초 적재·스케줄러·과거 자료 정리는 후속 작업에서 연결한다.

## 패키지와 책임

외부 API 자료, 수집 절차, 저장·조회에 사용하는 날씨 모델을 나눈다. `map.provider`와 같이 기상청 전용 통신·파싱·요청·응답 모델은 `provider.kma`에 모은다.

| 패키지               | 클래스                                                | 책임                                               |
| -------------------- | ----------------------------------------------------- | -------------------------------------------------- |
| `collector`          | `WeatherCollectionCommand`                            | CLI 인자·발표시각 문자열을 검증하고 한 번 실행     |
| `service`            | `WeatherCollectionService`                            | 요청·결합·저장의 실행 순서, 트랜잭션과 측정값 누적 |
| `service.collection` | `WeatherCollectionPlan`, `DailyForecastTarget`        | 수집 범위·요청 목록·미제공 대상·예상량 계산        |
| `service.collection` | `HourlyForecastAssembler`, `DailyForecastAssembler`   | 수집 응답 검증, 대상 격자 선택, 날씨 모델 결합     |
| `service.dto.result` | `WeatherCollectionResult`                             | 요청별 측정값과 커밋된 저장 입력량·소요시간 반환   |
| `provider.kma`       | `KmaForecastClient`, `KmaGridParser`                  | 기상청 HTTP 요청과 RAW 파싱                        |
| `provider.kma`       | `KmaForecastRequest`, `ForecastFetchResult`           | 외부 요청과 응답 수신 측정값 표현                  |
| `provider.kma`       | `GridForecast`, `GridValue`                           | 결합 전의 요소별 전국 격자 응답 표현               |
| `domain`             | `HourlyForecast`, `DailyForecast`, `DailyTemperature` | 서비스에서 사용하는 날씨·일별 기온과 출처          |
| `domain`             | `ForecastTimes`, `GridPoint`, `WeatherElement`        | 시각·격자·요소와 각 불변 조건                      |
| `repository`         | `JdbcWeatherForecastRepository`                       | 기존 최신성 규칙에 따른 JDBC 배치 UPSERT           |

서비스와 수집 협력 객체가 `provider.kma`의 요청·응답 모델을 사용하고 `domain` 모델을 만든다. `domain`은 `service`, `provider`, `collector`, `repository`를 참조하지 않는다. 수집 계획·어셈블러는 일반 Java 객체로 유지하며 Spring 빈으로 등록하지 않는다. 기상청 단일 공급자에 불필요한 Provider 인터페이스나 전달 전용 구현체는 추가하지 않는다.

문자열 입력 → `LocalDateTime` 변환은 CLI 경계에, `LocalDateTime` → 기상청 파라미터 변환은 요청 객체에 둔다. `ForecastTimes`에는 시각 자체의 의미와 불변 조건만 남긴다. 테스트의 `ForecastTimesFixture`는 CSV·HTTP 원본 검증 데이터의 시각을 읽는 테스트 전용 도구이며 운영 입력 검증에 사용하지 않는다.

## HTTP 클라이언트

`KmaForecastClient.fetch(request)`는 기상청 `nph-dfs_shrt_grd`에 `tmfc`, `tmef`, `vars`, `authKey`를 담은 GET 요청을 보내고, `KmaGridParser`로 검증한 `GridForecast`를 반환한다. `Accept: text/plain`으로 요청하고 숫자 RAW 본문은 UTF-8로 읽는다. 수집 서비스가 사용하는 `fetchMeasured`는 같은 처리 결과에 수신 바이트·HTTP 시간·파싱 시간을 함께 반환한다. `fetch`는 예보만 반환하며, 두 메서드 모두 `KmaForecastRequest`를 받는다.

```java
ForecastTimes times = new ForecastTimes(LocalDateTime.of(2026, 10, 22, 23, 0),
        LocalDateTime.of(2026, 10, 23, 0, 0));
KmaForecastRequest request = new KmaForecastRequest(times, WeatherElement.TMP);
GridForecast forecast = kmaForecastClient.fetch(request);
```

인증키만 `KMA_API_KEY` 환경변수로 주입한다. 기본값은 비어 있으며 개인 `.env`나 서버의 비밀값 설정으로 관리한다. 연결 제한시간 3초와 읽기 제한시간 15초는 `KmaForecastClient`의 `CONNECT_TIMEOUT`, `READ_TIMEOUT` 상수로 관리한다.

`KmaForecastClient`는 항상 빈으로 등록된다. 인증키 없이도 애플리케이션이 기동되며, 실제 `fetch` 호출 시 키가 비어 있으면 네트워크 요청 전에 설정 오류로 거부한다. 빈 생성만으로 요청을 보내지 않는다. 자동 수집·초기 적재·삭제 실행 플래그는 이후 해당 기능에서 별도로 추가한다.

HTTP 200 이외의 상태는 `WEATHER_PROVIDER_UNAVAILABLE`로 처리하고 디버깅 메시지에 상태 코드만 남긴다. 연결 실패·시간 초과·본문 읽기 실패도 외부 시스템 오류로 처리하되 HTTP 상태 오류와 다른 메시지로 구분한다. HTTP 200의 빈 본문·오류 본문·불완전한 격자는 파서가 `WEATHER_RESPONSE_INVALID`로 거부한다.

인증키는 URI 변수로 인코딩하며 리다이렉트를 따라가지 않는다. 요청 URL·오류 본문·외부 예외 메시지는 인증키를 포함할 수 있어 로그와 예외에 전달하지 않는다. 원인 예외도 같은 이유로 연결하지 않는다. 현재 클라이언트는 재시도를 수행하지 않으며 재처리 정책은 후속 작업에서 다룬다.

## 모델과 파서

| 클래스                    | 역할                                                   |
| ------------------------- | ------------------------------------------------------ |
| `WeatherElement`          | 수집 대상 10개 요소의 API 식별자                       |
| `ForecastTimes`           | KST 발표·예보시각 보관과 필수값·정시·선후 관계 검증    |
| `KmaForecastRequest`      | 기상청 요청 시각·요소와 `tmfc`·`tmef` 문자열 생성      |
| `DailyForecastTarget`     | 요청 여부와 별개인 일별 기온의 날짜·요소               |
| `WeatherCollectionPlan`   | 발표분별 시간별·일별 요청과 미제공 대상, 요청량 계산   |
| `GridPoint`               | 1부터 시작하는 격자 좌표와 원본 인덱스 변환            |
| `GridValue`               | 결측을 제외한 격자 한 곳의 원본 숫자                   |
| `GridForecast`            | 요청 시각·기상 요소·유효 격자 목록과 유효·결측 개수    |
| `KmaGridParser`           | 응답 구조 검증, 숫자 파싱과 결측 제외                  |
| `HourlyForecastAssembler` | 같은 발표·예보시각의 8개 응답을 TMP 유효 격자별로 결합 |
| `HourlyForecast`          | 같은 격자·발표·대상 시각의 시간별 8개 값과 수집시각    |
| `DailyForecastAssembler`  | 날짜별 TMP 서비스 격자에 제공되는 일별 기온을 연결     |
| `DailyTemperature`        | 일별 기온 한 요소의 값·발표시각·수집시각               |
| `DailyForecast`           | 같은 격자·대상 날짜의 TMN·TMX 수집 결과                |

파서는 Spring·HTTP·DB에 의존하지 않는다. RAW 본문에는 발표시각·예보대상시각·요소가 없으므로 호출자가 실제 요청에 사용한 메타데이터를 전달해야 한다.

```java
ForecastTimes times = new ForecastTimes(LocalDateTime.of(2026, 10, 22, 14, 0),
        LocalDateTime.of(2026, 10, 22, 17, 0));
GridForecast forecast = new KmaGridParser().parse(raw, times, WeatherElement.TMP);
```

`ForecastTimes`의 `LocalDateTime`은 KST 현지 시각이다. JVM 기본 시간대로 변환하지 않으며, 필수값·시간 단위·발표와 예보시각의 순서를 검증한다. 문자열 해석이나 API 파라미터 생성은 담당하지 않는다. `WeatherCollectionCommand`가 CLI의 `yyyyMMddHH` 입력을 10자리 ASCII 숫자·실재하는 날짜인지 엄격하게 검사하고, `KmaForecastRequest.tmfc()`·`tmef()`가 도메인 시각을 기상청의 10자리 문자열로 표현한다. `WeatherCollectionPlan`은 선택한 시각이 하루 8개 발표시각에 해당하는지 확인하고 요소별 요청을 만든다. 현재 시각에서 최신 공개 발표분을 자동 선택하는 기능은 스케줄러 단계에서 연결한다.

## RAW 파싱 규칙

- 쉼표로 구분된 값이 정확히 149 × 253 = 37,697개여야 한다. BOM, 값 주변 공백·줄바꿈, 마지막 쉼표 한 개를 허용한다.
- `index`는 결측을 포함한 원본의 0 기반 인덱스다. `nx = index % 149 + 1`, `ny = index / 149 + 1`로 계산한다. 물리적인 줄바꿈은 격자 행 경계가 아니다.
- `(1, 1)`은 첫 값, `(149, 1)`은 149번째 값, `(1, 2)`는 150번째 값이다. 마지막 값은 `(149, 253)`에 대응한다.
- `-99`·`-999`는 결과 목록에서 제외한다. 정상 0과 음수는 보존하며, 결측을 제거해도 이후 값의 좌표가 바뀌지 않는다.
- 결과 목록은 변경할 수 없다. 유효 격자 수는 응답마다 다르며 TMP의 특정 샘플 개수를 고정하지 않는다.
- 빈 응답·값 개수 불일치·빈 셀·숫자가 아닌 값·NaN/Infinity·전체 결측은 `UpstreamServiceException`과 `WEATHER_RESPONSE_INVALID`로 거부한다. 응답 원문과 원문을 포함하는 파싱 예외는 로그에 노출되지 않도록 예외 메시지·cause에 넣지 않는다.
- 파서는 숫자 구조를 검증하고 원본 숫자를 보존한다. 단위 환산·범주 해석·코드 범위 제한은 수행하지 않는다. 요소별 근거와 미확인 항목은 [10개 기상 요소의 RAW 파싱 계약](weather-raw-contract.md)을 따른다.

격자 인덱스와 샘플 값의 일치를 검증한 것이며, 실제 매물의 위경도 변환 검증은 조회 기능 작업에서 진행한다.

## 기상 요소와 예보시각별 수집 계획

`WeatherCollectionPlan.forPublication(publishedAt)`은 KST 발표시각 하나로 불변 계획을 생성한다. Spring·HTTP·DB·현재 시계에 의존하지 않으며, 계획 생성으로 API 요청이 실행되지는 않는다. 입력은 매일 02·05·08·11·14·17·20·23시 정시만 허용하고, 다른 시각이나 분·초·나노초가 있는 입력은 자동 보정하지 않고 거부한다.

```java
WeatherCollectionPlan plan = WeatherCollectionPlan.forPublication(LocalDateTime.of(2026, 10, 22, 17, 0));
List<KmaForecastRequest> hourly = plan.hourlyRequests(); // 10/22 18시부터 10/23 17시까지, 192건
List<KmaForecastRequest> daily = plan.dailyRequests();   // 10/23 TMN 06시·TMX 15시, 2건
int requests = plan.requestCount();                  // 194건
long rawValues = plan.expectedRawValueCount();       // 결측 포함 7,313,218개 숫자
long estimatedBytes = plan.estimatedResponseBytes(341_297); // 기존 RAW 크기 기준 66,211,618바이트
```

### 시간별 24개 대상시각

발표 다음 정시부터 24번째 정시까지 연속 24시간을 수집한다. 각 시각마다 `TMP·SKY·PTY·POP·PCP·SNO·REH·WSD` 순서로 요청하므로 시간별 요청은 항상 192건이다. 23시 발표분은 다음 날 00시부터 23시까지이며 당일 날짜가 계획에 포함되지 않는다.

이 24시간은 이번 수집 기능이 선택한 범위다. [격자 API의 전체 제공 범위](https://apihub.kma.go.kr/apiList.do?seqApi=10&seqApiSub=286)보다 짧으며 전체 예보기간을 모두 요청하지 않는다. `requests()`는 시간별 목록 뒤에 날짜순 일별 목록을 이어 반환한다. 각 `KmaForecastRequest`를 `KmaForecastClient.fetch` 또는 `fetchMeasured`에 그대로 전달할 수 있다.

### 일별 대상과 계획상 미제공

일별 기온은 시간별 24개 시각에 포함된 **날짜별**로 계산한다. 같은 날짜의 TMN은 06시, TMX는 15시를 `tmef`로 사용한다. 예를 들어 02시 발표의 마지막 시간별 대상은 다음 날 02시지만, 그 날짜의 TMN 06시와 TMX 15시도 요청한다. 일별 대표 요청 시각을 시간별 마지막 시각으로 잘라내지 않는다.

당일·익일 제공 여부는 [기상청 단기예보조회서비스 활용 가이드(2026-06-23)](https://apihub.kma.go.kr/getAttachFile.do?fileName=%EB%8B%A8%EA%B8%B0%EC%98%88%EB%B3%B4%EC%A1%B0%ED%9A%8C%EC%84%9C%EB%B9%84%EC%8A%A4_API%ED%99%9C%EC%9A%A9%EA%B0%80%EC%9D%B4%EB%93%9C_260623.docx)의 「최고/최저기온의 발표시간별 저장되는 예보자료 시간」 표를 계획 규칙으로 적용한다. 당일 TMN은 02시 발표분에만, 당일 TMX는 02·05·08·11시 발표분에 제공한다. 따라서 05시 발표에서 아직 미래인 당일 06시 TMN이나, 14시 발표에서 아직 미래인 당일 15시 TMX도 요청에서 제외한다. 다음 날의 두 요소는 모든 발표분에서 요청한다.

| KST 발표시각 | 계획에 포함된 날짜 | 일별 요청              | 계획상 미제공 목록 | 전체 요청 수 |
| ------------ | ------------------ | ---------------------- | ------------------ | -----------: |
| 02시         | 오늘·내일          | 오늘·내일 TMN·TMX      | 없음               |          196 |
| 05·08·11시   | 오늘·내일          | 오늘 TMX, 내일 TMN·TMX | 오늘 TMN           |          195 |
| 14·17·20시   | 오늘·내일          | 내일 TMN·TMX           | 오늘 TMN·TMX       |          194 |
| 23시         | 내일               | 내일 TMN·TMX           | 없음               |          194 |

`unavailableDailyForecasts()`에는 선택한 발표분에서 제공하지 않는 대상 날짜·요소를 남긴다. 요청하지 않은 요소는 이후 일별 저장 모델에서 미수집으로 다뤄야 하며, 정상 응답의 격자 결측인 `DailyTemperature(null, ...)`로 만들지 않는다. 23시 발표에서 오늘은 수집 대상 날짜 자체가 아니므로 이 목록에도 들어가지 않는다.

TMN 06시·TMX 15시의 격자 요청은 [기존 RAW 샘플](weather-raw-contract.md#발표시각과-예보대상시각)에서도 확인했다. 당일 제공 규칙은 공식 조회 가이드에 근거해 적용한 것이며 격자 엔드포인트의 모든 발표분을 실호출 대조한 결과는 아니다. 수동 수집 검증에서는 2026-10-23 02시 발표분의 당일·익일 TMN·TMX 제공을 확인했다. 다른 발표분의 미제공 경계와 자료 공개 지연은 아직 실측하지 않았다. 계획에 있는 요청의 실패·빈 본문·전체 결측을 계획상 미제공으로 바꾸면 안 된다.

### 요청 수와 예상 응답량

`requestCount()`는 실제 호출할 목록의 크기이고, `expectedRawValueCount()`는 이 수에 37,697을 곱한 결측 포함 원본 숫자 수다. DB 저장 행 수는 요소별 유효 격자와 결합 정책에 따라 달라지므로 여기에서 계산하지 않는다. `estimatedResponseBytes(bytesPerResponse)`에는 양수인 건당 실측 바이트를 전달하며, 응답 크기를 고정 계약으로 두지 않는다.

기존 10개 RAW가 각각 341,297바이트였다는 측정값을 적용하면 다음과 같다. MB는 1,000,000바이트 기준이다.

| 범위                              |       요청 수 |          예상 응답 바이트 |        예상 응답량 |
| --------------------------------- | ------------: | ------------------------: | -----------------: |
| 1회 수집                          | 194부터 196건 | 66,211,618부터 66,894,212 | 약 66.2부터 66.9MB |
| 하루 8개 발표분을 각각 한 번 수집 |       1,557건 |               531,399,429 |         약 531.4MB |

2026-10-23 확인한 [API허브 이용안내](https://apihub.kma.go.kr/apiInfo.do)의 일반회원 일 한도는 20,000건·5GB다. 위 일 예상치는 호출 한도의 약 7.8%, 5GB를 5,000,000,000바이트로 환산한 용량 한도의 약 10.6%다. 재시도·수동 재수집·다른 API 사용량과 HTTP 부가 데이터는 포함하지 않은 본문 기준 추정이며, 계정의 실제 잔여량을 조회하거나 호출을 제한하는 기능은 아니다. 한도는 변경될 수 있으므로 실행 환경에서 최신 이용안내와 계정 사용량을 확인한다.

## 동일 격자와 예보시각의 시간별 요소 결합

`HourlyForecastAssembler.assemble(expectedTimes, responses, collectedAt)`는 한 발표분·한 예보대상시각의 8개 `GridForecast`를 받아 격자별 `HourlyForecast` 목록을 반환한다. HTTP·DB·현재 시계에 의존하지 않으며, 결과를 기존 `upsertHourly`의 입력으로 사용할 수 있다. 수집 서비스는 8개 요청을 모두 마친 시각을 KST `collectedAt`으로 전달한다.

```java
ForecastTimes times = new ForecastTimes(LocalDateTime.of(2026, 10, 22, 17, 0),
        LocalDateTime.of(2026, 10, 22, 20, 0));
// responses: 위 times로 수신·파싱에 성공한 TMP·SKY·PTY·POP·PCP·SNO·REH·WSD 응답
List<HourlyForecast> hourly = new HourlyForecastAssembler().assemble(times, responses, collectedAt);
```

### 응답 검증과 좌표 연결

결합 전에 모든 응답이 예상 `ForecastTimes`와 같은지 확인한다. 응답끼리만 시각을 비교하지 않으므로, 8개 모두 잘못된 발표분·대상시각인 경우도 거부한다. 시간별 요소 목록은 `WeatherElement.hourlyElements()`에 한 번만 정의해 수집 계획과 결합기가 함께 사용한다.

- 8개 요소는 각각 정확히 한 응답씩 필요하다. 요소 누락·중복, `null` 응답과 TMN·TMX 혼입은 오류다.
- 한 요소 안의 같은 격자가 중복되면 오류다. TMP 대상 밖의 중복도 검사하며 어느 값을 선택할지 임의로 결정하지 않는다.
- 값은 각 응답의 목록 순서가 아니라 `(grid_x, grid_y)`로 연결한다. 파서가 결측을 제거하므로 같은 목록 인덱스가 같은 격자를 뜻하지 않는다.
- 내부적으로 고정 격자 위치에 값을 배치하고 원본 인덱스 순으로 결과를 만든다. 입력 요소·좌표 순서에 영향을 받지 않으며 반환 목록은 변경할 수 없다.
- 이 검증에서 발생하는 `IllegalArgumentException`은 내부 결합 입력의 불일치를 뜻한다. HTTP·파싱 실패는 기존 클라이언트·파서의 예외로 전파해야 하며, 실패한 요소를 누락시키거나 결측 응답으로 만들어 계속하지 않는다.

### TMP를 기준으로 한 대상 격자와 결측 처리

이번 정책은 **해당 시각 TMP 응답의 유효 격자**를 서비스 대상으로 삼는다. 기온이 있는 격자에 다른 날씨 정보를 붙이는 방식이다. SKY·PTY·WSD의 유효 범위가 더 넓어도 TMP가 없는 격자는 추가하지 않는다. 반대로 8개 요소의 교집합만 선택하면 다른 요소 하나의 결측 때문에 정상 기온까지 사라지므로, TMP가 유효한 행은 유지하고 나머지 요소의 정상 결측을 `null`로 표현한다.

| 입력 상태                                               | 결합 결과                                             |
| ------------------------------------------------------- | ----------------------------------------------------- |
| TMP 격자와 다른 요소 값이 모두 존재                     | 8개 원본 숫자를 그대로 저장 모델에 전달               |
| TMP는 유효하고 정상 응답의 다른 요소에 해당 좌표가 없음 | 해당 요소만 `null`; 나머지 값과 행은 유지             |
| TMP의 해당 좌표가 결측                                  | 다른 요소의 값 유무와 관계없이 이번 결과에서 제외     |
| 어떤 요소의 응답 자체가 누락·실패                       | 해당 시각의 결합을 성공으로 처리하지 않음             |
| 계획상 미제공인 일별 TMN·TMX                            | 시간별 8개 응답에 넣지 않고 일별 계획에서 별도로 처리 |

0·음수·소수는 변환하지 않는다. 파서가 제외한 `-99`·`-999`를 복원하지 않으며, 다른 예보시각·격자의 값이나 일별 기온으로 빈 값을 채우지 않는다. 시간별 8개 요소에는 계획상 미제공을 허용하는 분기가 없다.

대상 격자는 매 응답에서 결정하며 9,295개나 특정 좌표 목록을 고정하지 않는다. TMP 유효 범위를 육지 경계로 보증하는 것도 아니다. 테스트는 1·2·9,296·37,697개 격자와, TMP 격자에서 나머지 7개 요소가 모두 정상 결측인 경우도 확인한다.

새 응답에서 TMP가 결측으로 바뀐 격자는 이번 UPSERT 입력에서 빠진다. 결합기는 기존 DB 행을 삭제하거나 결측 행으로 갱신하지 않으므로, 해당 키의 이전 발표분이 남을 수 있다. 발표분 전체의 교체·공개와 실패 복구는 별도 정책이 필요하며 이번 결합이 이를 보장하지 않는다.

## 수동 전국 수집

`WeatherCollectionCommand`는 웹 서버 없이 애플리케이션을 열고 `WeatherCollectionService.collect(publishedAt)`을 한 번 호출한 뒤 종료한다. `bootRun` 등 일반 서버 기동 경로에는 Runner·스케줄러를 등록하지 않아 외부 요청이 발생하지 않는다. 선택한 DB에는 기존 Flyway 설정대로 마이그레이션이 적용된다.

`backend`에서 DB 연결 설정과 `KMA_API_KEY`를 환경변수로 준비한 뒤 실행한다. 개인 `.env`는 자동으로 읽지 않으므로 셸에 환경변수로 내보내야 한다. 아래 시각은 형식 예시이며 실제 API가 제공하는 발표분으로 바꾼다.

```bash
./gradlew collectWeather --args='--published-at=2026102302' --no-daemon
```

인자는 KST `yyyyMMddHH` 형식의 `--published-at` 하나만 허용한다. 중복 인자·잘못된 날짜·정규 발표시각이 아닌 입력은 DB 접속 전에 거부한다. DB 연결과 프로필은 기존 `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, `SPRING_PROFILES_ACTIVE` 환경설정을 사용한다. API 키를 명령 인자로 전달하지 않는다. 수집용 ON/OFF 환경변수는 추가하지 않았다.

### 실행 순서와 트랜잭션

1. 발표시각으로 수집 계획을 만들고 계획상 미제공인 일별 요소를 기록한다.
2. 예보시각마다 8개 요소를 순차 요청하고 파싱한다. 모두 성공하면 TMP 격자 기준으로 결합한다.
3. 한 예보시각의 전체 행을 트랜잭션 하나에서 배치 UPSERT하고 커밋한다. 이를 24시간 반복한다.
4. 날짜별로 계획된 TMN·TMX를 요청하고 일별 저장 모델로 결합한다. 날짜마다 별도 트랜잭션으로 저장한다.
5. 완료된 요청·저장 행 수와 각 단계의 시간을 로그 및 `WeatherCollectionResult`로 반환한다.

HTTP·파싱·결합 중에는 트랜잭션을 열지 않는다. 이미 트랜잭션을 연 호출자가 서비스를 실행하면 단위별 커밋 의미가 달라지므로 실행 전에 거부한다. 한 저장 단위 내부의 배치 오류는 해당 트랜잭션 전체를 롤백한다. HTTP·파싱·결합·DB 오류는 즉시 전파하며 다음 요청을 실행하지 않는다. 이전 시각·날짜의 커밋은 남는다. 재실행은 기존 UPSERT 최신성 규칙을 따르며, 중간 지점 재개·발표분 전체 원자성·동시 실행 제어는 이번 범위에 포함하지 않는다.

한 시각의 8개 파싱 결과와 저장 행만 유지하고 처리 후 해제할 수 있도록 순차 실행한다. 일별 처리에 필요한 날짜별 TMP 좌표 집합과 작은 요청 측정 목록은 실행 종료까지 유지한다. 24시간 전체의 RAW·저장 행을 메모리에 모으지 않는다.

### 일별 기온의 대상과 결측

일별 대상 격자는 **이번 24시간 계획에 포함된 해당 날짜의 TMP 유효 격자 합집합**이다. 하루 중 한 시각에라도 서비스 대상인 격자에는 일별 기온을 연결하며, TMN·TMX에서만 유효한 외부 격자는 추가하지 않는다. 이 좌표 집합은 고정 육지 마스크가 아니다.

`DailyForecastAssembler`는 요청 계획의 날짜·TMN 06시·TMX 15시·발표분과 실제 응답의 시각·요소·좌표 중복을 검증한다.

- 계획상 미제공인 요소는 `DailyTemperature` 객체 자체를 `null`로 두어 기존 값을 유지한다. 두 요소 모두 미제공인 날짜에는 요청·저장을 하지 않는다.
- 정상 응답에서 대상 격자의 값만 결측이면 `DailyTemperature(null, publishedAt, collectedAt)`을 만든다. 두 값 모두 결측이어도 두 출처를 남겨 이전 값을 지울 수 있다.
- 계획한 요청의 실패나 전체 결측 응답은 미제공으로 처리하지 않고 실행을 중단한다.
- 시간별 8개 응답 또는 날짜별 계획된 모든 일별 응답을 받은 직후를 해당 저장 단위의 `collectedAt`으로 사용한다. 주입받은 `Clock`의 Instant를 명시적으로 `Asia/Seoul`로 변환하고 DB와 같은 마이크로초 정밀도로 맞춘다. TMN·TMX의 출처 필드는 각각 유지하되 같은 날짜의 수집 완료시각을 함께 기록한다.

### 처리량과 시간의 의미

`weather-request-start`에는 시각·요소만, `weather-request-complete`에는 그 요청의 수신 바이트와 유효·결측 수, HTTP·파싱 시간이 기록된다. 인증키·요청 URL·RAW 본문을 로그에 남기지 않는다. `weather-hourly-stored`, `weather-daily-stored`는 커밋 완료를 뜻한다. 최종 `weather-collection-complete`의 `status`는 `success` 또는 `failed`다.

| 항목                                                   | 의미                                                                                   |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `attemptedRequests` / `completedRequests`              | 호출 시도 수 / HTTP·파싱을 모두 통과한 요청 수                                         |
| `responseBytes`                                        | 성공한 요청에서 읽은 본문 바이트 합계. HTTP 헤더·TLS·실패한 응답은 제외                |
| `validValues` / `missingValues`                        | 성공한 모든 요소·대상시각의 유효·결측 셀 합계. 중복 없는 좌표 수가 아님                |
| `hourlyCommittedInputRows` / `dailyCommittedInputRows` | 커밋이 성공한 UPSERT 입력 행 수. 신규 삽입·실제 갱신·기존 전체 행 수와 구분            |
| `httpNanos`                                            | 성공한 요청의 준비부터 본문 수신·응답 정리까지                                         |
| `parseNanos`                                           | 성공한 응답의 UTF-8 디코딩·RAW 검증·파싱                                               |
| `mergeNanos`                                           | 시간별·일별 모델 결합과 일별 대상 격자 누적                                            |
| `dbNanos`                                              | 커넥션 획득·JDBC 바인딩·배치·커밋·정리. 실패 시 롤백 시간도 포함                       |
| `totalNanos`                                           | 계획 생성부터 실행 결과 생성까지. 단계 사이의 로그·반복 처리와 실패한 요청 대기도 포함 |

모든 시간은 `System.nanoTime()` 차이로 측정한 나노초다. DB 시간에는 **커밋이 포함되고 검증 SELECT는 포함되지 않는다**. 실제 수집 서비스는 검증 SELECT를 실행하지 않으며, 원본 대조는 별도 테스트에서 한다. 실패 로그의 응답량·유효/결측·HTTP/파싱 시간은 이미 성공한 요청의 부분 합계다. 실패한 요청은 마지막 `weather-request-start`와 시도/완료 수 차이로 확인한다.

### 수집 경로의 재현과 원본 대조

`WeatherCollectionIntegrationTest`는 37,697개 토큰을 가진 가짜 응답과 격리된 MySQL 8.4.10을 사용한다. 02·05·14·23시 발표분의 196·195·194·194개 요청, 24개 예보시각, 날짜 경계, 미제공·정상 결측·0, 1,000행 배치 경계를 검증한다. 운영 파서·결합기를 재사용해 기대값을 만들지 않고 응답 토큰과 DB의 모든 값·출처 시각을 직접 비교한다. 두 번째 예보시각의 HTTP 실패 시 첫 시각만 남는 것과 비웹 애플리케이션 기동 시 자동 수집하지 않는 것도 확인한다.

```bash
./gradlew test --tests 'com.jachwisunbae.weather.*' --no-daemon
```

실제 API 검증은 기본 테스트에서 건너뛴다. `KMA_API_KEY`가 환경에 주입되어 있고 Docker가 실행 중일 때 아래처럼 발표분을 명시한다. 이 검증은 개인 DB에 쓰지 않고 Testcontainers DB를 생성·폐기하지만 실제 API 호출량을 사용한다.

```bash
WEATHER_LIVE_PUBLISHED_AT=2026102302 ./gradlew test \
  --tests '*WeatherCollectionIntegrationTest.verifiesLiveCollection' --rerun-tasks --no-daemon
```

실제 검증도 운영 수집 서비스·HTTP 제한시간·파서·결합기·저장소를 사용한다. 테스트에서는 수집시각 대조를 위해 시작 시각으로 `Clock`을 고정한다. 성공 후 수신 RAW와 측정 결과를 Git 제외 경로 `backend/build/weather-live/<발표시각>/`에 보관하며, 모든 저장 값·시각을 수신 원본과 대조한다. RAW에는 시각·요소 메타데이터가 없으므로 파일명과 실제 요청 정보를 함께 사용한다. 이 검증은 **요청한 시각을 저장하는 연결 계약**을 확인하며, 제공자가 요청과 다른 발표분의 본문을 보냈는지는 RAW만으로 판별할 수 없다.

### 실제 수집 검증 기록

2026-10-23에 `2026102302` 발표분으로 위 실제 API 검증을 실행했다. 격리된 MySQL 8.4.10에 처음 적재했으며, UTC DB 세션·`rewriteBatchedStatements=true` 설정을 사용했다. 시간별 대상은 KST 2026-10-23 03시부터 2026-10-24 02시까지다. 일별 대상은 10월 23일과 24일의 TMN 06시·TMX 15시다.

| 측정                          |                                결과 |
| ----------------------------- | ----------------------------------: |
| 성공 요청                     |         196건 (시간별 192 + 일별 4) |
| 수신 본문                     | 66,894,212바이트 (각 341,297바이트) |
| 유효 / 결측 셀                |               3,338,788 / 4,049,824 |
| 시간별 저장 입력 / DB 실제 행 |                   223,080 / 223,080 |
| 일별 저장 입력 / DB 실제 행   |                     18,590 / 18,590 |
| HTTP / 파싱                   |                  50.602초 / 0.798초 |
| 결합 / DB                     |                   0.172초 / 5.446초 |
| 수집 서비스 전체              |                            57.077초 |

시간별 24개 시각 모두 TMP 유효 격자는 9,295개였고 일별 두 날짜도 각 9,295행이었다. **모든 저장 행의 10개 요소 값과 발표·예보·수집시각을 원본 토큰 및 요청 메타데이터와 대조해 일치했다.** 다음은 그중 `(60, 127)` 격자의 예시다. 아래 값만 표본 검사한 것이 아니다.

| 대상                  | 원본과 DB에서 대조한 값                                    |
| --------------------- | ---------------------------------------------------------- |
| 10월 23일 20시 시간별 | TMP 17, SKY 1, PTY 0, POP 0, PCP 0, SNO 0, REH 75, WSD 1.5 |
| 10월 23일 일별        | TMN 7, TMX 21                                              |
| 10월 24일 일별        | TMN 13, TMX 21                                             |

검증 산출물은 `backend/build/weather-live/2026102302/`의 RAW 196개와 `verification.txt`다. 원본은 Git에 포함하지 않는다. 전체 소요시간에는 Gradle 컴파일·컨테이너 기동·Flyway·원본 대조 SELECT·산출물 저장이 포함되지 않는다. 테스트 자체는 약 1분 22초에 끝났다. 한 번의 로컬 실행 결과이므로 성능 보장이나 처리량 목표로 사용하지 않는다. 발표 직후 실행한 검증이 아니므로 공개 지연을 확인한 기록도 아니다.

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

정상 응답에서 특정 격자가 결측이면 해당 요소를 `NULL`로 저장한다. 실제 0과 음수 기온은 그대로 저장하며 원본 결측 코드 `-99`·`-999`를 직접 저장하면 CHECK 제약으로 거부한다. SKY·PTY 코드 범위와 미확인 변수의 물리 범위는 DB에서 추가 제한하지 않는다. 요청 실패를 정상 결측으로 바꾸는 것은 허용하지 않으며 `WeatherCollectionService`는 오류를 전파하고 해당 저장 단위를 쓰지 않는다.

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

요청 실패 이력을 이 테이블의 `NULL`로 표현하지 않는다. 응답 결측과 계획상 미제공을 구분할 수 있도록 저장소는 값과 해당 요소의 출처 시각을 함께 갱신한다.

### 시각·갱신·인덱스 기준

모든 시각은 KST `LocalDateTime`으로 전달한다. `DATETIME` 자체는 시간대를 저장하지 않으며 DB 세션 시간대에 의존하는 `CURRENT_TIMESTAMP` 기본값이나 자동 갱신 설정도 두지 않는다. 수집시각은 마이크로초까지 저장한다.

시간별 예보는 `forecast_at >= published_at`, 일별 기온은 각 발표일이 `forecast_date` 이하인지 검사한다. 발표·시간별 예보시각의 분·초는 0이어야 한다. 하루 8개 발표시각 선택과 TMN·TMX의 제공 시각은 수집 계획에서 검증한다.

최신성 비교는 시간별 행의 `published_at`, 일별 요소 각각의 `*_published_at`을 기준으로 JDBC 저장소의 UPSERT에서 수행한다. 더 최신 발표분과 같은 발표시각의 정정·재수집을 반영할 때 수집시각도 갱신하며, 과거 발표분을 무시할 때는 기존 수집시각도 유지한다. DB에 직접 UPDATE하면 이 보호가 적용되지 않는다.

기본키는 격자별 시각·날짜 조회를 지원한다. 보존기간 정리를 위한 시간 선두 인덱스나 추가 조회 인덱스는 실제 조회·삭제 비용을 측정한 뒤 추가한다.

## JDBC 배치 UPSERT

`JdbcWeatherForecastRepository`는 `JdbcTemplate.batchUpdate`로 최대 1,000행씩 실행한다. `upsertHourly(List<HourlyForecast>)`와 `upsertDaily(List<DailyForecast>)`를 제공하고 빈 목록은 아무 작업도 하지 않는다. 목록과 행은 null일 수 없으며, 입력 목록의 null 행은 쓰기 전에 거부한다.

입력 모델은 필수 메타데이터, 유한한 숫자, `-99`·`-999` 금지를 생성 시 검증한다. `HourlyForecast`는 8개 요소가 같은 발표·대상 시각에 속한다고 가정한다. `HourlyForecastAssembler`가 원본 `GridForecast`들의 시각·요소·좌표를 검증해 이 저장 모델을 만든다. `WeatherCollectionService`가 HTTP·결합·저장을 순서대로 실행한다.

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

저장소는 호출자가 연 Spring 트랜잭션에 참여하며 별도 트랜잭션을 시작하거나 커밋하지 않는다. 트랜잭션이 없으면 자동 커밋 설정에 따라 앞서 실행한 배치가 남을 수 있다. `WeatherCollectionService`는 시간별 한 시각 또는 일별 한 날짜의 저장을 트랜잭션으로 묶는다. 발표분 전체의 원자적 갱신·실패 재시도는 보장하지 않는다. DB 오류는 숨기지 않고 호출자에게 전달한다.

MySQL의 영향받은 행 수는 INSERT·UPDATE 여부와 드라이버 설정에 따라 다르므로 메서드는 삽입·갱신 건수로 환산한 값을 반환하지 않는다. 테스트는 실제 저장된 행과 값을 조회해 검증한다. JDBC URL의 `rewriteBatchedStatements` 설정은 변경하지 않았으며, 테스트는 OFF·ON 모두에서 같은 결과를 확인한다.

## 테스트와 실제 샘플 확인

`backend`에서 실행한다. 클라이언트·모델·파서 단위 테스트는 코드로 생성한 격자 데이터, 실제 RAW에서 발췌한 소형 CSV, `MockRestServiceServer`의 가짜 HTTP 응답을 사용하므로 실제 API 키·네트워크·DB·외부 원본 파일이 필요 없다. 인증키 유무에 따른 기동과 키가 없는 상태의 요청 거부도 확인한다.

`ForecastTimesTest`는 날짜 경계·필수값·발표와 예보시각의 선후 관계·정시 제약을 확인한다. `WeatherCollectionCommandTest`는 잘못된 날짜·길이·문자·발표시각을 CLI에서 거부하고, 윤년·JVM 시간대가 달라도 KST를 보존하는지 확인한다. `KmaForecastRequestTest`는 기상청 요청 문자열을 별도로 검증한다.

`WeatherCollectionPlanTest`는 8개 발표시각의 192개 시간별 요청, 날짜별 일별 요청·미제공 목록, 중복 방지·불변성·요청량 계산을 검사한다. 05시 TMN·14시 TMX 제외, 23시의 다음 날 전용 계획, 월말·연말·윤년, JVM 기본 시간대가 UTC·미국 서부여도 KST를 보존하는 경우를 포함한다.

`HourlyForecastAssemblerTest`는 순서가 뒤섞이고 유효 격자가 서로 다른 응답의 좌표 결합, TMP 기준 선택, 정상 결측·0·음수·소수, 응답 누락·중복·시각 불일치·중복 좌표 거부를 검사한다. `HourlyForecastAssemblerContractTest`는 기존 RAW 발췌 CSV를 파서와 결합기에 연이어 전달해 `(60, 127)`의 8개 값과 TMP 발췌 격자 4개의 좌표·기온을 대조한다. 발췌하지 않은 좌표를 결측으로 채운 테스트이므로 전체 실제 RAW의 유효 격자 수나 결측 분포를 재현한 결과는 아니다.

```bash
./gradlew test --tests 'com.jachwisunbae.weather.provider.kma.Kma*Test' \
  --tests 'com.jachwisunbae.weather.provider.kma.GridForecastTest' \
  --tests 'com.jachwisunbae.weather.domain.*' \
  --tests 'com.jachwisunbae.weather.service.*' \
  --tests 'com.jachwisunbae.weather.collector.*' --no-daemon
```

`WeatherSchemaIntegrationTest`, `JdbcWeatherForecastRepositoryTest`, `WeatherForecastRecollectionIntegrationTest`, `DatabaseBaselineIntegrationTest`는 Testcontainers의 MySQL 8.4.10을 사용하므로 Docker가 필요하다. 개인 로컬 DB 대신 별도 컨테이너에서 마이그레이션, 기본키·CHECK 제약, UPSERT 최신성·정정, NULL·0과 시각 보존, 배치·재실행, 호출자 트랜잭션의 롤백을 확인한다. 저장소 테스트는 DB 세션을 UTC로 설정해도 KST `LocalDateTime`이 변환되지 않는지 검사한다. SQL 변경 후에는 인수 테스트를 포함한 전체 검사도 실행한다.

```bash
./gradlew test --tests 'com.jachwisunbae.weather.database.*' \
  --tests 'com.jachwisunbae.weather.repository.*' \
  --tests 'com.jachwisunbae.common.database.DatabaseBaselineIntegrationTest' --no-daemon
./gradlew testAll --no-daemon
```

### 최초 적재·재수집 재현

`WeatherForecastRecollectionIntegrationTest`는 1,001개 격자에 여러 예보시각·날짜를 붙인 저장 입력을 코드로 생성한다. 1,001은 1,000행 배치 경계를 넘기기 위한 테스트 크기이며 실제 유효 격자 수가 아니다. HTTP 호출·RAW 파싱·요소 결합을 거치지 않는 저장소 통합 테스트로, 수집 경로 전체의 검증은 아래 `WeatherCollectionIntegrationTest`에서 별도로 진행한다.

- 시간별 대상은 KST `2026-10-22 23:00`, `2026-10-23 00:00`, `2026-10-23 01:00`이다. 일별 대상은 10월 22·23·24일이다.
- 17시 발표분을 먼저 적재한 뒤 20시 최신 발표분, 같은 발표시각의 정정, 수집시각만 늦은 과거 발표분을 차례로 전달한다.
- 재수집 입력에 없는 기존 행도 포함해 **DB 전체 행의 기본키·10개 요소·발표시각·수집시각**을 단계마다 대조한다. 기대 결과는 UPSERT 비교식을 다시 구현해 계산하지 않고 시나리오에서 명시한다.
- TMN만 수집했을 때 기존 TMX를 유지하고, 미수집 TMX를 TMN보다 과거인 발표분으로도 채울 수 있는지 확인한다. 한 행의 과거 TMN은 무시하면서 최신 TMX의 결측 정정은 반영한다.
- 값·발표시각·수집시각까지 같은 입력의 재실행과, 값은 같아도 수집시각이 달라지는 재수집을 구분한다. 정상 결측 `NULL`과 0의 양방향 정정, 음수·소수와 마이크로초 보존도 확인한다.

Docker를 실행한 뒤 `backend`에서 아래 명령으로 다시 측정한다. 외부 API 키와 저장소 밖의 원본 파일은 필요 없다. `--rerun-tasks`는 Gradle이 이전 테스트 결과를 재사용하지 않도록 한다.

```bash
./gradlew test --tests 'com.jachwisunbae.weather.repository.WeatherForecastRecollectionIntegrationTest' \
  --rerun-tasks --no-daemon
```

테스트는 `rewriteBatchedStatements=false`와 `true`에서 각각 실행한다. `build/reports/tests/test/index.html`의 해당 클래스 Standard output과 `build/test-results/test/TEST-com.jachwisunbae.weather.repository.WeatherForecastRecollectionIntegrationTest.xml`의 `system-out`에 `weather-storage-check` 기록을 남긴다.

`inserted`는 새 기본키, `updated`는 기존 행의 값 또는 출처 시각이 바뀐 행, `unchanged`는 변하지 않은 기존 행의 수다. **검증용 DB 전후 조회를 비교한 논리적 행 수**이며 JDBC 영향 행 수를 변환한 값이 아니다. `unchanged`에는 해당 단계의 입력에서 빠진 기존 행도 포함한다. `dbMicros`는 트랜잭션 실행 전부터 커밋·커넥션 정리가 끝날 때까지의 마이크로초다. 커넥션 생성, JDBC 바인딩과 배치 실행을 포함하고 컨테이너 기동·Flyway·입력 생성·전후 검증 조회는 제외한다. 단계마다 별도 트랜잭션을 사용한다.

2026-10-23 로컬 Java 21·MySQL 8.4.10에서 4개 시나리오 테스트가 모두 통과했다. 아래 각 행은 단계 하나의 결과이며, 두 드라이버 설정에서 같은 저장 결과를 확인했다. 삽입/갱신/유지는 모두 행 단위다.

| 단계                                                                                 | 테이블별 입력 행 | 테이블별 예상 / 실제 총행 | 시간별 삽입 / 갱신 / 유지 | 일별 삽입 / 갱신 / 유지 |
| ------------------------------------------------------------------------------------ | ---------------: | ------------------------- | ------------------------- | ----------------------- |
| 최초 적재 (`initial`)                                                                |            2,002 | 2,002 / 2,002             | 2,002 / 0 / 0             | 2,002 / 0 / 0           |
| 동일 입력 재실행 (`replay`)                                                          |            2,002 | 2,002 / 2,002             | 0 / 0 / 2,002             | 0 / 0 / 2,002           |
| 수집시각 갱신 (`recollect`)                                                          |            2,002 | 2,002 / 2,002             | 0 / 2,002 / 0             | 0 / 2,002 / 0           |
| 최신 발표와 새 대상 (`new-publication`)                                              |            2,002 | 3,003 / 3,003             | 1,001 / 1,001 / 1,001     | 1,001 / 1,001 / 1,001   |
| 정정과 과거 입력 / 미수집 요소 보충 (`correction-and-stale` / `correction-and-fill`) |            2,002 | 3,003 / 3,003             | 0 / 1,001 / 2,002         | 0 / 2,002 / 1,001       |
| 과거 발표 재수집 (`stale`)                                                           |            3,003 | 3,003 / 3,003             | 0 / 0 / 3,003             | 0 / 0 / 3,003           |
| NULL·0 정정 (`zero-correction`)                                                      |            1,001 | 3,003 / 3,003             | 0 / 1,001 / 2,002         | 0 / 1,001 / 2,002       |

같은 실행에서 기록한 DB 처리 시간이다. 표는 `dbMicros`를 밀리초로 환산했다. 단일 실행의 참고값으로, 워밍업·반복 측정을 거친 성능 비교나 통과 기준으로 사용하지 않는다. 애플리케이션의 JDBC URL 설정은 변경하지 않았다.

| 단계                                | 시간별 OFF (ms) | 시간별 ON (ms) | 일별 OFF (ms) | 일별 ON (ms) |
| ----------------------------------- | --------------: | -------------: | ------------: | -----------: |
| 최초 적재                           |         460.032 |         23.716 |       466.908 |       93.368 |
| 동일 입력 재실행                    |         350.730 |         20.502 |       368.535 |       48.167 |
| 수집시각 갱신                       |         390.998 |         34.332 |       350.617 |       43.769 |
| 최신 발표와 새 대상                 |         373.137 |         26.092 |       348.949 |       39.378 |
| 정정과 과거 입력 / 미수집 요소 보충 |         370.302 |         32.230 |       353.174 |       27.867 |
| 과거 발표 재수집                    |         521.960 |         32.422 |       516.871 |       28.532 |
| NULL·0 정정                         |         177.779 |         19.949 |       238.080 |       21.951 |

### 실제 RAW 샘플 대조

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
