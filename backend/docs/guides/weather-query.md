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

## 위치 저장·조회·삭제

`MemberWeatherLocationController → MemberWeatherLocationService → MemberWeatherLocationRepository`가 본인 위치만 다룬다. `GET / PUT / DELETE /api/members/me/weather-location`은 기존 익명 회원 JWT의 회원 ID를 사용한다.

앱을 실행하거나 새 위치를 획득하면 다음 두 필드만 PUT으로 전달한다.

```json
{
  "latitude": 37.5665,
  "longitude": 126.978
}
```

서버는 회원과 좌표를 확인하고 KMA 격자로 변환한 뒤 `member_id` 기준으로 INSERT 또는 UPDATE한다. 같은 회원의 기존 격자는 새 요청의 격자로 갱신한다. 정확한 위경도는 저장하지 않는다.

위치 테이블은 `member_id`, `grid_x`, `grid_y`, `updated_at` 네 컬럼만 가진다. 격자는 NOT NULL이며 `updated_at`은 서버 시계의 UTC 저장시각이다. 저장시각을 비교해 요청을 무시하거나 알림을 차단하지 않는다.

PUT과 GET의 응답은 다음과 같다.

```json
{
  "data": {
    "available": true,
    "gridX": 60,
    "gridY": 127,
    "updatedAt": "2026-10-25T13:00:00Z"
  }
}
```

`available`은 저장된 격자가 존재한다는 의미다. DELETE는 본인의 위치 행을 삭제하고 204를 반환한다. 미등록 상태의 DELETE도 204이며, 삭제 후 같은 PUT이 오면 다시 등록된다. 위치가 없을 때 GET은 다음 응답을 반환한다.

```json
{
  "data": {
    "available": false,
    "gridX": null,
    "gridY": null,
    "updatedAt": null
  }
}
```

## 정기 알림의 위치 정책과 한계

07시·22시 알림은 판정을 시작할 때 조회한 **마지막 저장 격자**를 사용한다. 발송 시점의 실시간 GPS를 조회하지 않는다. 위치가 하루 전이나 일주일 전에 저장됐더라도 사용하며, 저장된 격자가 없으면 발송하지 않는다. 위치 저장시각과 별개로 수신 동의·FCM 등록정보·정상 예보·중복 방지 검사는 유지한다.

아래 문제는 이번 MVP에서 해결하지 않는다.

- 장기간 앱을 실행하지 않으면 과거 위치를 기준으로 알림이 발송될 수 있다.
- 실제로 이동했어도 앱에서 위치를 다시 동기화하지 않으면 이전 지역의 날씨가 발송된다.
- 위치 삭제 후 오래된 PUT 요청이 늦게 도착하면 위치가 다시 등록될 수 있다. 요청의 획득 순서나 삭제 시각은 보존하지 않는다.
- 휴대폰 OS에서 위치 권한을 철회해도 서버가 자동으로 감지하지 못한다. 앱이 DELETE를 호출해야 한다.

## API 변경과 후속 연결

위치 PUT에서 `observedAt`을 제거했고, 응답의 `observedAt`·`syncedAt`은 `updatedAt`으로 대체했다. 클라이언트는 위도·경도만 전송하고 위치 등록 여부와 서버 저장시각을 사용한다. 쿼리·본문의 좌표를 배포 프록시 로그에 노출하지 않도록 한다.

기존 값별 `NOT_COLLECTED / NOT_PROVIDED / STALE / UNVERIFIED`는 `UNAVAILABLE`로 합쳤다. 클라이언트는 원인별 화면 분기 대신 값의 사용 가능 여부를 처리한다. 날짜·격자·출처·정상 0·결측의 의미는 유지한다.

조회용 `StoredReading`은 완료 기록을 포함한 DB 결과이고 `WeatherForecastResult`는 판정 후 결과다. 둘은 내부 검증 필드가 외부 응답으로 새지 않도록 구분한다. API DTO는 KST 오프셋과 공개 필드를 표현하며, 알림은 같은 조회 서비스를 재사용한다.

모바일 GPS·권한·WebView 전달·날씨 화면은 이번 백엔드 범위에 포함하지 않는다. 앱이 위치 권한을 철회하면 해제 API를 호출해야 한다. 서버가 OS 권한 변경이나 실제 이동을 독립적으로 알 수는 없다.
