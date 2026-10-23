# 전국 날씨 데이터 수집

전국 단기예보 격자자료의 HTTP 수신·RAW 파싱·모델을 설명한다. 현재는 선택한 발표시각·예보대상시각·요소 한 개의 전국 자료를 요청하고 검증할 수 있다. DB 저장·수집 명령·자동 실행은 후속 작업에서 연결한다.

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

| 클래스           | 역할                                                |
| ---------------- | --------------------------------------------------- |
| `WeatherElement` | 수집 대상 10개 요소의 API 식별자                    |
| `ForecastTimes`  | KST 발표시각과 예보대상시각, `tmfc`·`tmef` 변환     |
| `GridPoint`      | 1부터 시작하는 격자 좌표와 원본 인덱스 변환         |
| `GridValue`      | 결측을 제외한 격자 한 곳의 원본 숫자                |
| `GridForecast`   | 요청 시각·기상 요소·유효 격자 목록과 유효·결측 개수 |
| `KmaGridParser`  | 응답 구조 검증, 숫자 파싱과 결측 제외               |

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
- 파서는 숫자 구조만 검증한다. SKY·PTY 코드 범위, POP의 의미, PCP·SNO의 단위·비0 값 해석은 변수별 계약 검증에서 보강한다.

격자 인덱스와 샘플 값의 일치를 검증한 것이며, 실제 매물의 위경도 변환 검증은 조회 기능 작업에서 진행한다.

## 테스트와 실제 샘플 확인

`backend`에서 실행한다. 테스트는 코드로 생성한 격자 데이터와 `MockRestServiceServer`의 가짜 HTTP 응답을 사용하므로 실제 API 키·네트워크·DB·외부 원본 파일이 필요 없다. 인증키 유무에 따른 기동과 키가 없는 상태의 요청 거부도 확인한다.

```bash
./gradlew test --tests 'com.jachwisunbae.weather.*' --no-daemon
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
