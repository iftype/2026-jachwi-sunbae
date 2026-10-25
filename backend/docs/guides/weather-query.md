# 현재 위치 날씨 조회와 동기화 MVP

날씨 조회는 요청으로 받은 좌표를 사용하며, 정기 알림은 회원이 마지막으로 동기화한 격자를 사용한다. 정확한 위경도를 DB에 저장하지 않고 서버에서 기기 GPS를 직접 조회하지 않는다.

## 조회 흐름

`WeatherForecastController → WeatherForecastQueryService → WeatherForecastQueryRepository` 순서다. 기존 익명 회원 JWT를 요구하며 `GET /api/weather/forecasts`에 위도·경도와 오늘 또는 내일의 날짜를 전달한다. 날짜를 생략하면 KST 오늘이다. 입력·응답·오류의 기준은 Controller Swagger/OpenAPI다.

`KmaGridConverter`가 위경도를 공식 Lambert 투영의 기상청 격자로 변환한다. 잘못된 위경도·NaN·무한대·격자 범위 밖 입력을 거부하며 경계로 강제 보정하지 않는다. 서울·수원·부산·제주와 RAW 인덱스의 회귀 테스트를 유지한다. 격자 범위 안이라는 이유만으로 육지나 서비스 가능 지역이라고 단정하지 않는다.

저장소는 해당 격자의 날짜 범위만 PK로 읽는다. 조회마다 기상청을 호출하거나 전국 격자를 순회하지 않는다. 별도 캐시는 없다. 오늘·내일 각각 00–23시의 24개 시간대와 일별 TMN·TMX를 반환하며, 아직 저장하지 못한 시간대는 빈 값이다.

## 예보 상태

| 상태          | 의미                                                    |
| ------------- | ------------------------------------------------------- |
| `AVAILABLE`   | 완료 기록·수집시각·신선도를 확인한 정상 수치. 0도 보존  |
| `MISSING`     | 완료된 정상 자료의 해당 값이 결측                       |
| `UNAVAILABLE` | 미수집·미제공·오래된 자료·완료 미확인 등 사용할 수 없음 |

`AVAILABLE` 이외의 수치는 `null`이며 출처가 있으면 발표·수집시각은 보존한다. 전체 `coverage`는 사용할 수 있는 값의 범위에 따라 `AVAILABLE / PARTIAL / UNAVAILABLE`이다. 미수집 바다와 미수집 육지를 구별하지 않는다.

최신 발표 선택은 KST 발표 후 15분 가정이다. 기대 발표분보다 6시간을 초과해 오래된 값은 사용할 수 없다. 과거 시간대는 해당 시각에 기대했던 발표를 기준으로 하고, 당일 TMN·TMX의 기대 발표는 각각 02시·11시에서 멈춘다. 알림은 여기에 05시·20시 이상 발표분이라는 조건을 추가한다.

`weather_collection_publications`의 `started_at`·`completed_at`과 행의 `collected_at`을 함께 검사한다. 완료 기록 없는 기존 자료나 실패 중인 발표분을 정상값으로 반환하지 않는다. 최신 실패분이 이전 성공값을 덮어쓴 경우 이전 값 복원은 지원하지 않는다.

조회하는 시간별·일별 예보와 완료 기록은 [V3](../../src/main/resources/db/migration/V3__create_weather_forecasts.sql)에 정의되어 있다. 위치 저장용 `member_weather_locations`는 [V4](../../src/main/resources/db/migration/V4__create_weather_user_features.sql)가 생성한다. 위치 테이블은 `member_id` PK·회원 FK와 격자 범위 CHECK를 유지한다.

## 위치 동기화

`MemberWeatherLocationController → MemberWeatherLocationService → MemberWeatherLocationRepository`가 본인 위치만 다룬다. `GET / PUT / DELETE /api/members/me/weather-location`으로 조회·동기화·해제한다.

- 저장 값은 격자, 실제 위치 확인시각(`location_observed_at`), 서버 저장시각(`synced_at`), 해제시각(`invalidated_at`)이다.
- 동기화에는 최근 5분 이내의 실제 확인시각을 요구하고 미래 기기 시각 오차는 최대 1분 허용한다. 캐시 위치의 확인시각을 현재로 바꾸면 안 된다.
- SQL 조건부 UPSERT로 이전·동일 확인시각은 무시한다. 해제 전 요청이 뒤늦게 도착해도 위치를 복구하지 않는다.
- 조회의 `available`은 위치 등록 여부다. 알림에서는 별도로 실제 확인 후 24시간 이내인지 검사한다.
- 위치 시각은 UTC `Instant`, 예보시각·대상 날짜는 KST 계약이다. 쿼리·본문을 배포 프록시 로그에도 노출하지 않도록 한다.

## API 변경과 후속 연결

기존 값별 `NOT_COLLECTED / NOT_PROVIDED / STALE / UNVERIFIED`는 `UNAVAILABLE`로 합쳤다. 클라이언트는 원인별 화면 분기 대신 값의 사용 가능 여부를 처리한다. 날짜·격자·출처·정상 0·결측의 의미는 유지한다.

조회용 `StoredReading`은 완료 기록을 포함한 DB 결과이고 `WeatherForecastResult`는 판정 후 결과다. 둘은 내부 검증 필드가 외부 응답으로 새지 않도록 구분한다. API DTO는 KST 오프셋과 공개 필드를 표현하며, 알림은 같은 조회 서비스를 재사용한다.

모바일 GPS·권한·WebView 전달·날씨 화면은 이번 백엔드 범위에 포함하지 않는다. 앱이 위치 권한을 철회하면 해제 API를 호출해야 한다. 서버가 OS 권한 변경이나 실제 이동을 독립적으로 알 수는 없다.
