# 로컬 개발

## 1. 준비물

| 항목           | 기준                                       |
| -------------- | ------------------------------------------ |
| JDK            | Java 21                                    |
| Docker         | MySQL·MinIO 컨테이너를 실행할 수 있는 버전 |
| Node.js        | `frontend/.nvmrc`와 같은 버전              |
| Git            | GitHub 저장소를 복제할 수 있는 버전        |
| HTTP 확인 도구 | `curl` 또는 브라우저                       |

Gradle은 별도로 설치하지 않는다. 저장소의 Gradle Wrapper를 사용한다.

## 2. 환경변수 준비

`backend`에서 개인 환경변수 파일을 만든다.

```bash
cp .env.example .env
```

기본 예시는 외부 키가 필요 없는 닉네임 인증·`demo` 지도와 로컬 MinIO 값을 포함한다. `.env`는 Git에 커밋하지 않는다.

## 3. 로컬 인프라 실행

`backend`에서 실행한다.

```bash
docker compose up -d
docker compose ps
```

MySQL과 MinIO가 healthy여야 한다. 빈 MySQL 볼륨은 [월세 거래 테이블을 포함한 기준 스키마](../../src/main/resources/db/init/001-schema.sql)와 시스템 체크 항목,
[로컬 버스정류장 샘플](../../docker/mysql/init/003-bus-stops-sample.sql), [로컬 CCTV 샘플](../../docker/mysql/init/005-cctvs-sample.sql)로 자동 초기화된다.
Compose가 각 SQL을 읽기 전용으로 마운트하며 파일명의 번호 순서 (`001` → `002` → `003` → `004` → `005`)로 실행한다.
초기화 SQL은 기존 볼륨에 다시 적용되지 않으며, 볼륨을 삭제하면 로컬 데이터도 사라진다.

초기화 SQL이 바뀐 뒤 예전 볼륨으로 실행해 `Unknown column` 같은 스키마 오류가 나면 MySQL 볼륨만 다시 만든다. `docker compose down -v`는 MinIO 사진 볼륨까지 지우므로 쓰지 않는다.

```bash
docker compose stop mysql
docker compose rm -f mysql
docker volume rm jachwi-sunbae-backend_mysql-data
docker compose up -d mysql
```

### 버스정류장 데이터

버스정류장 조회 (`GET /api/maps/bus-stops`)는 `bus_stops` 테이블에서 조회한다.
빈 볼륨에는 `docker/mysql/init/003-bus-stops-sample.sql`이 판교, 서울 시청, 신림 주변 2.5km의 정류장 샘플을 자동으로 넣는다.
샘플은 로컬 Docker 초기화 전용이며 애플리케이션 JAR에 포함하지 않는다.
다른 지역을 확인하려면 아래의 전체 데이터를 적재한다.

이미 만든 볼륨에는 테이블과 샘플이 생기지 않는다.
볼륨을 지우면 회원·매물 데이터도 사라지므로, 대신 다음 명령으로 추가한다.
기준 스키마는 없는 테이블만 만들고, 샘플 적재는 기존 `bus_stops` 데이터를 샘플로 교체한다.

```bash
docker compose exec -T mysql mysql -ujachwi_sunbae -plocal_password jachwi_sunbae < src/main/resources/db/init/001-schema.sql
docker compose exec -T mysql mysql -ujachwi_sunbae -plocal_password jachwi_sunbae < docker/mysql/init/003-bus-stops-sample.sql
```

전국 데이터가 필요하면 [국토교통부 전국 버스정류장 위치정보](https://www.data.go.kr/data/15067528/fileData.do) CSV를 내려받아 적재 SQL을 만든다. 생성한 SQL은
약 20MB이므로 저장소 밖에 둔다.

```bash
python3 scripts/bus-stops/generate_bus_stops_sql.py "<CSV 경로>" --output /tmp/bus-stops.sql
docker compose exec -T mysql mysql -ujachwi_sunbae -plocal_password jachwi_sunbae < /tmp/bus-stops.sql
```

적재 SQL은 한 트랜잭션 안에서 기존 정류장을 지우고 다시 넣으므로, 샘플을 전국 데이터로 바꾸거나 전국 데이터를 다시 적재할 때도 같은 명령을 쓴다.

### CCTV 데이터

CCTV 조회 (`GET /api/maps/cctvs`)는 `cctvs` 테이블에서 조회한다.
빈 볼륨에는 `docker/mysql/init/005-cctvs-sample.sql`이 버스정류장 샘플과 같은 판교, 서울 시청, 신림 주변 2.5km의 CCTV 샘플을 자동으로 넣는다.
샘플은 로컬 Docker 초기화 전용이며 애플리케이션 JAR에 포함하지 않는다.

이미 만든 볼륨에는 테이블과 샘플이 생기지 않으므로 다음 명령으로 추가한다. 샘플 적재는 기존 `cctvs` 데이터를 샘플로 교체한다.

```bash
docker compose exec -T mysql mysql -ujachwi_sunbae -plocal_password jachwi_sunbae < src/main/resources/db/init/001-schema.sql
docker compose exec -T mysql mysql -ujachwi_sunbae -plocal_password jachwi_sunbae < docker/mysql/init/005-cctvs-sample.sql
```

전국 데이터가 필요하면 [전국CCTV표준데이터](https://www.data.go.kr/data/15013094/standard.do) CSV를 내려받아 적재 SQL을 만든다.
원본에 좌표가 있어 외부 API 키 없이 몇 초 만에 만들 수 있다. 생성한 SQL은 약 48MB이므로 저장소 밖에 둔다.

```bash
python3 scripts/cctvs/generate_cctvs_sql.py "<CSV 경로>" --output /tmp/cctvs.sql
docker compose exec -T mysql mysql -ujachwi_sunbae -plocal_password jachwi_sunbae < /tmp/cctvs.sql
```

적재 SQL은 한 트랜잭션 안에서 기존 CCTV를 지우고 다시 넣는다. 정제 규칙은 스크립트 상단에 있고, 테스트는 `scripts/cctvs`에서 `python3 -m unittest`로 실행한다.

### 착한가격업소 데이터

착한가격업소 조회 (`GET /api/maps/good-price-stores`)는 `good_price_stores` 테이블에서 조회한다.
빈 볼륨에는 `docker/mysql/init/004-good-price-stores-sample.sql`이 버스정류장 샘플과 같은 판교, 서울 시청, 신림 주변 2.5km의 업소 샘플을 자동으로 넣는다.
샘플은 로컬 Docker 초기화 전용이며 애플리케이션 JAR에 포함하지 않는다.

이미 만든 볼륨에는 테이블과 샘플이 생기지 않으므로 다음 명령으로 추가한다. 샘플 적재는 기존 `good_price_stores` 데이터를 샘플로 교체한다.

```bash
docker compose exec -T mysql mysql -ujachwi_sunbae -plocal_password jachwi_sunbae < src/main/resources/db/init/001-schema.sql
docker compose exec -T mysql mysql -ujachwi_sunbae -plocal_password jachwi_sunbae < docker/mysql/init/004-good-price-stores-sample.sql
```

전체 데이터가 필요하면 [행정안전부 착한가격업소 현황](https://www.data.go.kr/data/3045247/fileData.do) CSV를 내려받아 적재 SQL을 만든다.
원본에 좌표가 없어 주소를 SGIS로 변환하므로 SGIS 키가 필요하고, 전체 실행에 약 15분이 걸린다. 중간에 중단되면 같은 명령으로 다시 실행해 이어서 변환한다.

```bash
export SGIS_CONSUMER_KEY=... SGIS_CONSUMER_SECRET=...
python3 scripts/good-price-stores/generate_good_price_stores_sql.py "<CSV 경로>" --source-date 2026-06-30 --output /tmp/good-price-stores.sql
docker compose exec -T mysql mysql -ujachwi_sunbae -plocal_password jachwi_sunbae < /tmp/good-price-stores.sql
```

적재 SQL은 한 트랜잭션 안에서 기존 업소를 지우고 다시 넣는다. 정제 규칙은 스크립트 상단에 있고, 테스트는 `scripts/good-price-stores`에서 `python3 -m unittest`로 실행한다.

### 월세 거래 데이터

월세 거래 조회 (`GET /api/rental-transactions`)는 `rental_transactions` 테이블에서 조회한다. 빈 볼륨에는 [기준 스키마](../../src/main/resources/db/init/001-schema.sql)가 월세 테이블을 만들며 거래 데이터는 넣지 않는다.
기존 DB에 월세 테이블이 없다면 관리자가 기준 스키마 끝의 `legal_dongs`, `rental_datasets`, `rental_transactions` 테이블 정의만 순서대로 적용한다. 운영 DB에 기준 스키마 전체를 다시 실행하지 않는다.
적재 도구는 테이블을 만들지 않고 기존 스키마를 확인한다.
법정동은 `admin_dongs`의 행정동과 코드 체계가 달라 `legal_dongs`에 별도로 저장한다. 면적 기준은 주택 유형에서 결정되므로 거래 테이블에 중복 저장하지 않으며, 정제 CSV의 `area_basis` 값은 적재 전에 주택 유형과 일치하는지 검증한다.
주택·계약 유형, 월세와 면적의 제공 조건은 적재 전에 도메인에서 검증하고, DB는 수집본·법정동 참조와 원본 행의 중복을 제약한다.

월세 적재에는 원본 다운로드 후 제공 조건에 맞게 정제한 거래 CSV와 공식 법정동 코드 ZIP 또는 TXT가 필요하다. 검증만 실행하려면 `backend`에서 다음과 같이 실행한다.

```bash
./gradlew importRentalTransactions --args="--transactions=/path/to/transactions.csv --legal-dong-codes=/path/to/legal-dong-codes.zip --from=2026-04-09 --to=2026-10-09 --collected-at=2026-10-09T12:00:00+09:00 --expected-rows=86079 --report-dir=/path/to/rental-report"
```

기간·수집 시각·예상 건수는 실제 자료에 맞게 지정한다. 보고서가 `VALIDATED`이고 미매핑 법정동이 0건일 때 `--apply`를 붙여 DB에 적재한다.
재실행할 때는 새 보고서 경로를 사용한다. 조회 API는 적재된 거래만 반환한다.

## 4. 백엔드 실행

`backend`에서 실행한다.

```bash
set -a
source .env
set +a
./gradlew bootRun
```

IntelliJ IDEA에서 애플리케이션이나 Gradle 작업을 직접 실행하면 `.env`가 자동으로 주입되지 않는다. 이 경우 Run Configuration의 환경변수에 `.env`와 같은 값을 설정하거나 위
터미널 명령으로 실행한다.

로컬 CORS는 `CORS_ALLOWED_ORIGINS=http://localhost:3000`을 사용한다.

| 확인 항목    | 주소                                          |
| ------------ | --------------------------------------------- |
| 서버 상태    | `http://localhost:8080/actuator/health`       |
| Swagger UI   | `http://localhost:8080/swagger-ui/index.html` |
| OpenAPI JSON | `http://localhost:8080/v3/api-docs`           |

```bash
curl --fail http://localhost:8080/actuator/health
curl --fail http://localhost:8080/v3/api-docs
```

두 요청이 성공해야 한다. 실제 API 계약은 구현에서 생성되는 Swagger/OpenAPI로 확인한다.

## 5. 프론트엔드 실행

별도 터미널의 `frontend`에서 실행한다.

```bash
npm ci
cp .env.example .env.local
set -a
source .env.local
set +a
npm run dev
```

브라우저에서 `http://localhost:3000`을 열고 닉네임을 입력한다. 비밀번호를 비우면 같은 닉네임을 입력한 사람이 기록을 함께 사용할 수 있다. 비밀번호를 입력하면 같은 닉네임의
비밀번호 없는 기록과 분리된 보호 기록으로 시작하고, 이후 같은 비밀번호가 필요하다. 빈 데이터베이스에서는 최초 로그인 시 회원이 생성되며 매물은 직접 등록한다.

실제 네이버 지도 화면을 확인할 때는 프론트엔드 `.env.local`의 `MAP_PROVIDER_MODE`를 `naver`로 바꾸고 `NAVER_MAP_CLIENT_ID`를 설정한다.

실제 주소 검색과 역지오코딩을 확인할 때는 백엔드 `.env`에 `MAP_PROVIDER_MODE=public`과
`JUSO_CONFIRM_KEY`, `SGIS_CONSUMER_KEY`, `SGIS_CONSUMER_SECRET`을 설정하고 백엔드를 다시 실행한다.

실제 주변 시설을 확인할 때는 백엔드 `.env`에 `MAP_NEARBY_PROVIDER=kakao`와 `KAKAO_REST_API_KEY`를 설정하고 백엔드를 다시 실행한다.
`MAP_NEARBY_PROVIDER`가 없으면 `demo` 주변 시설이 반환된다.  
Kakao Developers 앱에 허용 IP를 설정했다면 현재 PC의 공인 IP를 등록해야 한다.  
등록하지 않으면 주변 시설 조회가 503으로 실패하고 서버 로그에 `ip mismatched`가 남는다.

## 6. 검사

```bash
./gradlew test --no-daemon
```

프론트엔드는 변경 범위에 맞춰 `npm run build`를 실행하고, 필요에 따라 타입·린트·포맷·테스트를 확인한다.

## 7. 확인 목록

- [ ] `./gradlew bootRun`으로 애플리케이션이 실행된다.
- [ ] Actuator health가 `UP`을 응답한다.
- [ ] Swagger UI와 OpenAPI JSON에 접근할 수 있다.
- [ ] Docker MySQL과 MinIO가 healthy다.
- [ ] `./gradlew test --no-daemon`이 성공한다.
- [ ] 프론트엔드가 백엔드 `/api` 요청을 보낼 수 있다.
- [ ] 닉네임으로 시작한 뒤 매물·사진·메모·체크리스트·2~5개 매물 비교 PDF·지도 흐름이 동작한다.
