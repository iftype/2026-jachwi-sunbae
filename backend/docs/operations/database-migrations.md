# DB 마이그레이션

## 실행 방식과 설정

Spring Boot가 기동 시 Flyway로 미적용 마이그레이션을 실행한다. 로컬·통합 테스트·dev·prod는 같은 SQL을 사용하며,
적용 이력은 각 DB의 `flyway_schema_history`에 저장한다. Compose는 SQL 초기화를 실행하지 않는다.

| 항목      | 현재 설정                                                    |
| --------- | ------------------------------------------------------------ |
| SQL 경로  | `backend/src/main/resources/db/migration`                    |
| 최초 버전 | `V1__initial_schema.sql`: 24개 테이블과 시스템 체크 항목     |
| 기준선    | `baseline-version=1`, `baseline-on-migrate=false`            |
| 검증      | `validate-on-migrate=true`, `validate-migration-naming=true` |
| 보호 설정 | `clean-disabled=true`, `spring.sql.init.mode=never`          |

백엔드는 `JdbcTemplate`을 사용하며 JPA·Hibernate의 `ddl-auto`는 사용하지 않는다.

## 로컬 실행

빈 DB에서는 [로컬 개발 가이드](../guides/local-development.md#4-백엔드-실행)에 따라 앱을 실행하면 V1–V5와 이력 테이블이 생성된다.
기존 DB에 Flyway 이력이 없다면 아래 최초 전환이 필요하다.

`local` 프로필에서는 Flyway 실행 후 비어 있는 버스정류장·착한가격업소·CCTV 테이블에만 샘플을 자동 적재한다.
샘플은 `backend/docker/mysql/init`에 있으며 작업 디렉터리는 `backend`여야 한다. dev·prod에서는 적재하지 않는다.

## 기존 DB의 최초 전환

V1의 스키마와 기본 데이터가 이미 있고 Flyway 이력이 없는 DB에만 기준선을 등록한다.
등록 전에 대상 DB·스키마·기본 데이터·백업을 확인한다. 기준선 등록은 실제 스키마를 비교하거나 보정하지 않는다.

최초 기동에만 `SPRING_FLYWAY_BASELINE_ON_MIGRATE=true`를 지정하면 V1을 다시 실행하지 않고 버전 1의 `BASELINE` 이력을 남긴다.
등록 후에는 설정을 제거한다. `.env`나 Vault의 `app_env`에 상시 저장하지 않는다.
Flyway 이력이 없는 기존 DB에 기준선 등록 없이 연결하면 기동이 실패한다.

### 로컬의 기존 볼륨

다른 백엔드 프로세스를 종료한 뒤 `backend`에서 한 번 실행한다.

```bash
set -a
source .env
set +a
SPRING_FLYWAY_BASELINE_ON_MIGRATE=true ./gradlew bootRun
```

등록과 정상 기동을 확인한 뒤 종료한다. 이후에는 `./gradlew bootRun`으로 실행한다.

### dev·prod의 기존 RDS

배포 담당자가 dev를 먼저 전환하고 확인한 뒤 prod에 적용한다. DB별로 한 번 수행한다.
각 대상 EC2에서 첫 Flyway 리비전이 배포되기 전에 임시 systemd 설정을 준비한다.

```bash
sudo install -d -m 0755 /etc/systemd/system/jachwi-sunbae.service.d
sudoedit /etc/systemd/system/jachwi-sunbae.service.d/flyway-baseline.conf
```

새 파일에 다음 두 줄을 저장한다. 같은 이름의 설정이 이미 있으면 덮어쓰지 않고 기존 내용을 먼저 확인한다.

```ini
[Service]
Environment=SPRING_FLYWAY_BASELINE_ON_MIGRATE=true
```

```bash
sudo systemctl daemon-reload
```

해당 환경에 첫 Flyway 리비전을 배포하고 health가 `UP`인지 확인한다.
대상 DB에서 다음 조회 결과가 버전 `1`, 유형 `BASELINE`, 성공 `1`인지 확인한다.

```sql
SELECT version, type, success
FROM flyway_schema_history
ORDER BY installed_rank;
```

등록 후 임시 설정을 제거하고 재시작한다. 설정 추가·제거에는 코드 변경이나 별도 PR이 필요 없다.

```bash
sudo rm /etc/systemd/system/jachwi-sunbae.service.d/flyway-baseline.conf
sudo systemctl daemon-reload
sudo systemctl restart jachwi-sunbae.service
```

빈 DB에서는 V1이 실제 실행되므로 이력 유형이 `SQL`이다.

## 최종 V1–V5 구조

| 버전 | 파일                                         | 역할                                   |
| ---- | -------------------------------------------- | -------------------------------------- |
| V1   | `V1__initial_schema.sql`                     | 기존 초기 스키마                       |
| V2   | `V2__add_bus_stops_coordinate_index.sql`     | 버스정류장 위도·경도 인덱스            |
| V3   | `V3__introduce_anonymous_authentication.sql` | 익명 회원·Refresh Token                |
| V4   | `V4__create_weather_forecasts.sql`           | 시간별·일별 예보와 수집 완료 기록      |
| V5   | `V5__create_weather_user_features.sql`       | 회원 위치·수신 설정·FCM 기기·알림 이력 |

V1·V2와 `develop`의 익명 인증 V3는 원본을 유지한다. 인증 V3는 회원 ID·생성/수정시각과 연관 기록을 보존하면서 닉네임·비밀번호 컬럼을 제거하고 `deleted_at`, `refresh_tokens`를 추가한다.

[V4](../../src/main/resources/db/migration/V4__create_weather_forecasts.sql)는 과거 날씨 V3와 메타데이터 단순화 결과를 하나의 CREATE 정의로 통합한다. `weather_forecasts`, `weather_daily_forecasts`, `weather_collection_publications`를 생성하며 `started_at`·완료시각 교차 CHECK·파서/수집 계획과 중복된 세부 CHECK는 처음부터 생성하지 않는다. PK·격자 범위·시간별 시각 순서·일별 출처 조합과 `completed_at` 기반 완료 확인은 유지한다. 별도의 중간 ALTER 마이그레이션은 없다.

[V5](../../src/main/resources/db/migration/V5__create_weather_user_features.sql)는 기존 회원 날씨 기능 DDL을 번호만 옮긴 것이다. `member_weather_locations`는 회원 ID·격자·UTC `updated_at`만 저장하고 회원 FK·격자 NOT NULL·범위 CHECK를 유지한다. 기기는 회원당 하나이며 토큰 해시 유니크 제약을 유지한다. 알림은 `notices JSON NOT NULL`에 `condition`, `message` 배열을 저장하고 회원·발송일·슬롯 중복을 막는다. 과거 판정 상태·기기 관리 필드는 복원하지 않는다.

[스키마 기준 데이터](../../src/test/resources/db/weather-mvp-schema.json)는 최종 7개 날씨 테이블의 DDL을 기록한다. 테스트는 일회용 MySQL에서 빈 DB의 5개 적용과 재실행, V1·V2의 회원·매물·체크리스트 보존, 인증 V3의 회원·Refresh Token 보존과 V4·V5 추가 적용을 검증한다. V4 직후부터 최종 예보 스키마인지 확인하고 V5 적용 후에도 예보 값과 완료 기록이 유지되는지 비교한다.

## 기존 날씨 버전 적용 이력 확인

이 통합 파일은 날씨 스키마의 최초 배포용이며, 과거 날씨 버전을 적용한 DB의 자동 전환 경로가 아니다. Flyway 사용 여부와 특정 날씨 SQL 적용 여부를 구분해 배포 담당자가 **각 Dev·Prod DB의 실제 이력**을 확인한다. 이번 정리에서는 영구 DB에 접속하거나 이력·테이블을 수정하지 않았다.

```sql
SELECT version, description, script, checksum, success
FROM flyway_schema_history
ORDER BY installed_rank;
```

V3가 `introduce_anonymous_authentication`인지 과거 `create_weather_forecasts`인지 파일명·체크섬으로 구분한다. 과거 날씨 V3·V4·V5 또는 실패 이력이 발견되면 배포를 중단하고 별도 전환 계획을 정한다. 번호 변경만으로 해결되지 않으며 `repair`, 이력 직접 수정, `CREATE TABLE IF NOT EXISTS`로 충돌을 숨기지 않는다. 인증 V3까지 정상 적용된 DB에는 V4·V5 두 개만 추가된다.

앞서 확인한 로컬 DB 두 곳(`jachwi-sunbae-backend-mysql-1`, `jachwi-weather-lab-mysql-1`)에는 과거 날씨 V3와 서로 다른 체크섬이 기록되어 있었다. 현재 파일로 바로 기동하면 검증 충돌이 발생할 수 있다. 이 확인은 Dev·Prod의 날씨 버전 미적용을 증명하지 않는다.

- **데이터를 보존할 DB:** 기존 DB와 백업을 보존하고 실제 스키마·이력을 조사한다. 새 V1–V5 DB로 회원 ID·연관 기록·날씨 데이터를 옮기는 별도 변환·검증 계획 등을 수립한다. 실제 적용된 예전 DDL에 따라 달라지므로 이번 작업에서 자동 이관하거나 기존 날씨 테이블을 삭제하지 않는다.
- **버려도 되는 로컬 개발 데이터:** 담당자가 폐기를 결정한 경우 별도의 새 DB/볼륨에 V1–V5를 적용하고 연결을 전환할 수 있다. 기존 볼륨을 임의로 초기화하거나 공유 DB를 테스트용으로 사용하지 않는다.

## 이후 변경 SQL 작성

현재 이 브랜치의 최종 버전은 V5다. 다음 변경의 버전은 실제 배포 이력과 다른 브랜치의 파일을 확인한 뒤 정한다. 파일명은 `V<버전>__<설명>.sql` 형식이며 밑줄 두 개를 사용한다.

- 버전이 겹치지 않도록 적용 순서를 조율한다. DB 변경이 없으면 새 SQL을 만들지 않는다.
- 적용된 V1과 이후 SQL은 수정·이동·삭제하지 않고 다음 버전을 추가한다.
- `CREATE TABLE IF NOT EXISTS`로 기존 테이블의 컬럼 변경을 대신하지 않는다. 필요한 `ALTER TABLE`을 명시한다.
- 기능 코드·SQL·테스트를 같은 PR에 포함하고 dev에서 확인한 파일을 그대로 prod에 배포한다.
- 앱 계정 또는 별도 Flyway 계정에는 해당 변경을 수행할 DDL 권한이 필요하다.
- 주변 시설·교통·월세 대량 참조 데이터는 별도 적재 도구로 관리한다. 로컬 샘플은 `local` 프로필의 초기화 설정에서 적재하며 버전 마이그레이션에 포함하지 않는다.
- `clean`은 비활성화되어 있다. 이력이나 체크섬 불일치가 나면 원인을 확인하고 임의의 `repair`로 덮지 않는다.

Flyway의 `validate`는 적용 파일과 이력의 체크섬 등을 확인한다. 수동 변경으로 생긴 DB 스키마 차이 전체를 자동 검출하는 기능은 아니다.
SQL 변경 시 관련 테스트와 `backend`의 `./gradlew testAll --no-daemon`을 실행한다.
실패한 마이그레이션과 코드 롤백은 [롤백 절차](rollback.md#데이터베이스-변경이-포함된-롤백)를 따른다.
