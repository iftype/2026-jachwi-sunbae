# 현재 위치 날씨 조회와 동기화 MVP

날씨 조회는 요청으로 받은 좌표를 사용하며, 정기 알림은 회원이 마지막으로 동기화한 격자를 사용한다. 정확한 위경도를 DB에 저장하지 않고 서버에서 기기 GPS를 직접 조회하지 않는다.

## 조회 흐름

`WeatherForecastController → WeatherForecastQueryService → WeatherForecastQueryRepository` 순서다. 기존 익명 회원 JWT를 요구하며 `GET /api/weather/forecasts`에 위도·경도와 조회할 날짜를 전달한다. 날짜를 생략하면 KST 오늘이다. 조회 가능한 날짜를 따로 제한하지 않는다. 입력·응답·오류의 기준은 Controller Swagger/OpenAPI다.

`KmaGridConverter`가 위경도를 공식 Lambert 투영의 기상청 격자로 변환한다. 잘못된 위경도·NaN·무한대·격자 범위 밖 입력을 거부하며 경계로 강제 보정하지 않는다. 서울·수원·부산·제주와 RAW 인덱스의 회귀 테스트를 유지한다. 격자 범위 안이라는 이유만으로 육지나 서비스 가능 지역이라고 단정하지 않는다.

저장소는 해당 격자의 날짜 범위만 PK로 읽는다. 조회마다 기상청을 호출하거나 전국 격자를 순회하지 않는다. 별도 캐시는 없다. 요청한 날짜의 00–23시 24개 시간대와 일별 TMN·TMX를 반환하며, 아직 저장하지 못한 시간대는 빈 값이다. 수집 범위(발표 후 48시간) 밖이거나 보존 기간이 지난 날짜는 해당 시각의 값이 `null`이다.

## 조회 응답

DB의 시간별 한 행을 `WeatherForecastResult.Hour`로 읽고 API DTO로 변환한다. 중간 요소별 Map·`StoredReading`·`Reading`은 없다. 서비스의 시각별 Map 하나는 00–23시 24칸의 빈 시간을 채우는 데 사용한다.

시간별 항목은 `forecastAt`, `publishedAt`과 nullable 숫자 `tmp`, `sky`, `pty`, `pop`, `pcp`, `sno`, `reh`, `wsd`다. 최상위에는 `gridX`, `gridY`, `date`, `timeZone`, `hourly`, `tmn`, `tmx`, `tmnPublishedAt`, `tmxPublishedAt`이 있다. 예보·발표시각은 `+09:00`, `timeZone`은 `Asia/Seoul`이다. TMN·TMX는 독립적으로 갱신되므로 각각 발표시각을 제공한다.

시간별 항목 예시:

```json
{
  "forecastAt": "2026-10-25T23:00:00+09:00",
  "publishedAt": "2026-10-25T20:00:00+09:00",
  "tmp": 0.0,
  "sky": 1.0,
  "pty": 0.0,
  "pop": 0.0,
  "pcp": 0.0,
  "sno": null,
  "reh": 55.0,
  "wsd": 1.0
}
```

정상 0은 숫자 0으로, 미수집·미제공·결측·미완료는 `null`로 표현한다. `status`, `coverage`, `checkedAt`, 요소별 `collectedAt`은 제공하지 않는다. 미수집 바다와 미수집 육지를 구별하지 않는다.

`weather_collection_publications`의 해당 발표분에 `completed_at`이 있으면 조회한다. 재수집 시작 시 완료 표시를 비우므로 실패 중인 발표분은 숨긴다. 시작·완료·행 수집시각 사이의 교차 검증은 하지 않는다. 최신 실패분이 이전 성공값을 덮어쓴 경우 이전 값 복원은 지원하지 않는다.

6시간 신선도 제한과 조회시각별 기대 발표 계산은 없다. 현재 DB에 남은 완료 예보를 반환하며 최신 기상청 발표라고 보장하지 않는다. 클라이언트는 실제 `publishedAt`을 표시할 수 있다. 알림도 같은 자료를 사용하고 별도 05시·20시 발표 조건을 두지 않는다.

예보 테이블은 [V3](../../src/main/resources/db/migration/V3__create_weather_forecasts.sql)가 생성하며 [V5](../../src/main/resources/db/migration/V5__simplify_weather_collection_metadata.sql)가 `started_at`과 중복 CHECK를 제거한다. 위치 테이블은 [V4](../../src/main/resources/db/migration/V4__create_weather_user_features.sql)가 생성한다. 위치의 회원 PK·FK와 격자 범위 CHECK는 유지한다.

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

기존 요소별 `{value, status, publishedAt, collectedAt}` 응답은 시간별 nullable 숫자와 공통 발표시각으로 변경했다. 클라이언트는 `hourly[i].values.TMP.value` 대신 `hourly[i].tmp`를 읽고 `null`을 제공 불가로 처리한다. API DTO는 KST 오프셋과 공개 필드를 표현하며 알림은 같은 조회 서비스를 재사용한다.

모바일 GPS·권한·WebView 전달·날씨 화면은 이번 백엔드 범위에 포함하지 않는다. 앱이 위치 권한을 철회하면 해제 API를 호출해야 한다. 서버가 OS 권한 변경이나 실제 이동을 독립적으로 알 수는 없다.
