# 환경변수

## 관리 원칙

Spring Boot 애플리케이션은 CORS 허용 Origin과 인증·저장소 설정을 환경변수로 주입받는다. 아래 값 중 로컬 인프라용 값은 Docker Compose에서 사용하고, 애플리케이션 설정에 연결된 값은
실행 환경에 맞게 제공한다.

- 예시와 기본값은 `backend/.env.example`에 기록하고 Git에 커밋한다.
- 개인 값은 `backend/.env`에 기록하며 Git에 커밋하지 않는다.
- 실제 비밀번호, 토큰과 운영 비밀값은 문서, 코드, 예시 파일에 기록하지 않는다.
- 환경변수를 추가하거나 이름을 변경하면 애플리케이션 설정, Compose, `.env.example`과 이 문서를 같은 PR에서 수정한다.

## 로컬 인프라용 환경변수

| 환경변수                     | 로컬 기본값             | 용도                                                                                     |
| ---------------------------- | ----------------------- | ---------------------------------------------------------------------------------------- |
| `DB_HOST`                    | `localhost`             | MySQL 호스트                                                                             |
| `DB_PORT`                    | `3306`                  | MySQL 포트                                                                               |
| `DB_NAME`                    | `jachwi_sunbae`         | 데이터베이스 이름                                                                        |
| `DB_USERNAME`                | `jachwi_sunbae`         | 애플리케이션 계정                                                                        |
| `DB_PASSWORD`                | `local_password`        | 애플리케이션 계정 비밀번호                                                               |
| `DB_ROOT_PASSWORD`           | `local_root_password`   | 로컬 MySQL root 비밀번호                                                                 |
| `DB_SSL_MODE`                | `DISABLED`              | 운영 JDBC TLS 모드. 로컬 프로필은 별도 설정을 사용한다                                   |
| `JWT_SECRET`                 | 32바이트 이상 문자열    | HS256 서명 비밀값. 문자열 그대로 키로 쓴다. 운영 값은 `openssl rand -base64 32`로 만든다 |
| `CORS_ALLOWED_ORIGINS`       | `http://localhost:3000` | 쉼표로 구분한 프론트엔드 Origin 허용 목록                                                |
| `PHOTO_STORAGE_ENDPOINT`     | `http://localhost:9000` | S3 호환 객체 저장소 API endpoint. 정적 자격증명으로 접속하는 환경에서만 쓴다             |
| `PHOTO_STORAGE_REGION`       | `us-east-1`             | S3 서명에 사용하는 region                                                                |
| `PHOTO_STORAGE_BUCKET`       | `jachwi-sunbae-photos`  | 로컬 MinIO 사진 객체 bucket                                                              |
| `PHOTO_STORAGE_KEY_PREFIX`   | 비움                    | 객체 key 앞에 붙일 경로. 버킷을 다른 팀과 공유할 때 사용하며 로컬은 전용 버킷이라 비운다 |
| `PHOTO_STORAGE_ACCESS_KEY`   | 로컬 전용 예시 값       | 객체 저장소 access key. 정적 자격증명으로 접속하는 환경에서만 쓴다                       |
| `PHOTO_STORAGE_SECRET_KEY`   | 로컬 전용 예시 값       | 객체 저장소 secret key. 정적 자격증명으로 접속하는 환경에서만 쓴다                       |
| `PHOTO_STORAGE_PORT`         | `9000`                  | 로컬 MinIO API 포트                                                                      |
| `PHOTO_STORAGE_CONSOLE_PORT` | `9001`                  | 로컬 MinIO 관리 화면 포트                                                                |
| `MAP_PROVIDER_MODE`          | `demo`                  | `demo` 또는 `public` 주소 검색·역지오코딩 adapter 선택                                   |
| `JUSO_CONFIRM_KEY`           | 비움                    | `public` 모드의 행정안전부 도로명주소 검색 API 승인키                                    |
| `SGIS_CONSUMER_KEY`          | 비움                    | `public` 모드의 국가데이터처 SGIS 서비스 ID                                              |
| `SGIS_CONSUMER_SECRET`       | 비움                    | `public` 모드의 국가데이터처 SGIS 보안키. 백엔드 전용으로 관리한다                       |
| `MAP_NEARBY_PROVIDER`        | `demo`                  | `demo` 또는 `kakao` 주변 시설 adapter 선택. 비우면 `demo`로 동작한다                     |
| `KAKAO_REST_API_KEY`         | 비움                    | `kakao` 모드의 Kakao Developers REST API 키. 백엔드 전용으로 관리한다                    |
| `MAP_CONNECT_TIMEOUT_MILLIS` | `2000`                  | 지도 외부 공급자 연결 제한 시간                                                          |
| `MAP_READ_TIMEOUT_MILLIS`    | `5000`                  | 지도 외부 공급자 응답 제한 시간                                                          |
| `DEPLOYMENT_ENVIRONMENT`     | `local`                 | 구조화 로그의 실행 환경. EC2에서는 `dev` 또는 `prod`를 사용한다                          |
| `LOG_PATH`                   | `./logs`                | `dev`·`prod` 프로필에서 JSON 로그 파일을 저장할 디렉터리                                 |

## 날씨의 외부 인증정보와 프로필

날씨 기능은 아래 인증정보만 외부에서 주입한다. 실행 여부와 Firebase 프로젝트 ID는 `application-{profile}.yml`에서 관리한다.

| 환경변수                         | 기본값 | 용도                                                                                        |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------------- |
| `KMA_API_KEY`                    | 비움   | Dev·Prod 전국 격자 수집에 필요한 기상청 API허브 키. Local에서는 불필요                      |
| `GOOGLE_APPLICATION_CREDENTIALS` | 미설정 | FCM 활성화 후 파일 기반 ADC를 사용할 때의 저장소 밖 자격증명 경로. 다른 ADC 방식이면 불필요 |

현재 저장소의 실행 설정은 다음과 같다.

| 기능                                       | Local      | Dev                     | Prod                    |
| ------------------------------------------ | ---------- | ----------------------- | ----------------------- |
| `weather.collection.enabled`               | OFF        | ON                      | ON                      |
| `weather.cleanup.enabled`                  | OFF        | ON                      | ON                      |
| `weather.notification.enabled`             | OFF        | OFF: Firebase 준비 대기 | OFF: Firebase 준비 대기 |
| `weather.notification.firebase-project-id` | 사용 안 함 | 빈 값: 프로젝트 미생성  | 빈 값: 프로젝트 미생성  |

공통 `application.yml`은 세 기능 모두 기본 OFF다. `application-local.yml`도 OFF를 명시하고, `application-dev.yml`·`application-prod.yml`이 수집·정리를 활성화한다. 서버 시작 시 수집하지 않고 다음 예약 실행에서 빈 DB에도 같은 경로로 적재한다. 최초 적재 전용 설정·수동 CLI는 없다. 수집은 KST 02·05·08·11·14·17·20·23시 15분, 정리는 매일 00:30이다. 공개 지연 15분은 아직 실측 전 가정이다.

Dev·Prod의 최종 목표는 FCM도 ON이지만, 2026-10-25 확인 결과 두 Firebase 프로젝트가 아직 생성되지 않았다. 실제 프로젝트 ID·ADC·앱 등록이 준비되기 전에는 현재 OFF를 유지한다. 준비 후 각 프로필의 `firebase-project-id`에 서로 다른 실제 ID를 고정하고 `weather.notification.enabled`를 `true`로 바꾼다. 프로젝트 ID는 비밀이 아니지만 임의 값을 넣지 않는다. 빈 ID로 알림을 활성화하면 자격증명을 읽기 전에 기동에 실패한다.

- Dev 서버·개발 앱은 Dev Firebase 프로젝트와 개발용 자격증명·토큰을 사용한다.
- Prod 서버·운영 앱은 Prod Firebase 프로젝트와 운영용 자격증명·토큰을 사용한다.
- 서비스 계정의 `project_id`와 서버 YAML, 앱의 Firebase 설정이 같은 환경을 가리키는지 확인한다. 다른 ADC 방식을 쓰면 해당 환경의 프로젝트 접근 권한을 확인한다.
- Dev DB에 운영 회원의 FCM 토큰을 복제하지 않는다. 회원 수신 동의는 기존처럼 기본 OFF다.
- KMA 키도 가능하면 환경별로 분리한다. 발급 정책상 같은 키를 쓰면 Dev·Prod의 합산 호출량·허용량을 확인한다.
- API 키와 서비스 계정 JSON·비공개 키는 Git에 넣지 않는다. 실제 FCM 수신과 앱 토큰의 프로젝트 일치는 별도 배포 전 검증이다.

기존 날씨 ON/OFF·강수 검증·Firebase 프로젝트 ID 환경변수 항목은 `.env`, Vault `app_env`와 실행 환경에서 제거한다. Spring 표준 우선순위상 환경변수가 YAML보다 우선할 수 있으므로, 기존 값을 남긴 채 프로필만 바꾸면 의도한 정책과 달라질 수 있다. 별도 환경변수 차단 계층은 두지 않는다.

[수집 흐름](weather-collection.md), [강수 데이터 계약](weather-raw-contract.md), [정기 알림](weather-notifications.md)을 참고한다.

## 사용 방법

`backend`에서 개인 파일을 생성한다.

```bash
cp .env.example .env
```

Docker Compose는 같은 디렉터리의 `.env`를 자동으로 읽는다. Spring Boot를 직접 실행할 때는 셸 또는 실행 환경에 필요한 값을 주입한다.

## dev·prod 프로필

Dev는 `SPRING_PROFILES_ACTIVE=dev`, Prod는 `SPRING_PROFILES_ACTIVE=prod`로 기동하며 `/etc/jachwi-sunbae/app.env`에서 환경변수를 읽는다. 기존 Dev도 `prod`를 사용했으므로 이 버전 배포 전에 Vault의 Dev `app_env`를 `dev`로 변경해야 한다. 저장소 수정만으로 현재 서버나 Vault 값이 바뀌지는 않는다. 애플리케이션은 80 포트를 직접 사용한다.
실제 값은 환경마다 분리하고 파일 권한은 `root:root`, `0600`으로 유지한다.

| 설정                       | dev                            | prod                           |
| -------------------------- | ------------------------------ | ------------------------------ |
| `SPRING_PROFILES_ACTIVE`   | `dev`                          | `prod`                         |
| `CORS_ALLOWED_ORIGINS`     | `https://dev.jachwi-sunbae.kr` | `https://www.jachwi-sunbae.kr` |
| `PHOTO_STORAGE_REGION`     | `ap-northeast-2`               | `ap-northeast-2`               |
| `PHOTO_STORAGE_BUCKET`     | `techcourse-project-2026`      | `techcourse-project-2026`      |
| `PHOTO_STORAGE_KEY_PREFIX` | `jachwi-sunbae/photos-dev/`    | `jachwi-sunbae/photos/`        |
| `MAP_PROVIDER_MODE`        | `public`                       | `public`                       |
| `MAP_NEARBY_PROVIDER`      | `kakao`                        | `kakao`                        |
| `DEPLOYMENT_ENVIRONMENT`   | `dev`                          | `prod`                         |
| `LOG_PATH`                 | `/var/log/jachwi-sunbae`       | `/var/log/jachwi-sunbae`       |

DB 접속값과 `JWT_SECRET`, `JUSO_CONFIRM_KEY`, `SGIS_CONSUMER_KEY`, `SGIS_CONSUMER_SECRET`, `KAKAO_REST_API_KEY`는 환경별 실제 값이
필요하다.

`JWT_SECRET`은 사람이 만든 문장 대신 `openssl rand -base64 32`로 환경마다 새로 만든 값을 넣는다.
비어 있거나 32바이트보다 짧으면 애플리케이션이 시작되지 않는다.

`JUSO_CONFIRM_KEY`는 유효기간 90일 승인키이며 2026-12-25에 만료된다.

`MAP_PROVIDER_MODE`는 `demo` 또는 `public`만 사용할 수 있다. `public` 모드에 행안부 및 SGIS 키가 없으면 애플리케이션이 시작되지 않는다.
착한가격업소 적재 스크립트도 주소를 좌표로 바꿀 때 같은 `SGIS_CONSUMER_KEY`, `SGIS_CONSUMER_SECRET`을 사용한다. 스크립트는 개발자 PC에서 실행하므로 서버 환경변수에는 추가하지 않는다.

`MAP_NEARBY_PROVIDER`를 빠뜨리면 오류 없이 `demo` 주변 시설 (가짜 데이터)로 동작하므로 dev·prod에는 반드시 `kakao`를 넣는다.
Kakao Developers 앱에 허용 IP를 설정했다면 서버가 외부로 나가는 IP (VPC NAT 게이트웨이 IP)를 등록해야 한다.

AWS S3는 EC2 `ec2-project` instance role로 접근하므로 `PHOTO_STORAGE_ENDPOINT`, `PHOTO_STORAGE_ACCESS_KEY`,
`PHOTO_STORAGE_SECRET_KEY`를 EC2에 두지 않는다. 이 세 값은 로컬 MinIO에만 사용한다. 프론트엔드에는 지도 화면용 공개 Naver Maps Client ID만 빌드 타임에 주입한다.
백엔드는 네이버 API를 사용하지 않는다.

`src/main/resources/db/migration/V1__initial_schema.sql`은 기존 스키마와 시스템 체크 항목을 고정한 최초 마이그레이션이다.
백엔드 기동 시 Flyway가 아직 적용하지 않은 버전을 실행한다. 현재 목록은 V1–V4이며 새 변경은 적용 이력과 다른 브랜치의 버전을 확인한 뒤 미사용 버전으로 추가한다.
`docker/mysql/init/003-bus-stops-sample.sql`, `004-good-price-stores-sample.sql`, `005-cctvs-sample.sql`은 로컬 샘플이며 애플리케이션 JAR에 포함하지 않는다.
`local` 프로필에서는 Flyway 실행 후 각 테이블이 비어 있을 때만 자동 적재한다. 작업 디렉터리는 `backend`여야 한다.
`dev`·`prod` 프로필에서는 이 샘플 적재를 실행하지 않는다.

`spring.flyway.baseline-on-migrate`의 기본값은 `false`다. 기존 DB를 처음 연결할 때는 백업과 기준 스키마 일치를 확인한 뒤
`SPRING_FLYWAY_BASELINE_ON_MIGRATE=true`를 해당 최초 기동에만 지정한다. 기준선 등록 후에는 반드시 제거한다.
평상시 `.env`나 Vault의 `app_env`에 이 값을 상시 등록하지 않는다.
로컬과 dev·prod의 전환 명령은 [DB 마이그레이션](../operations/database-migrations.md)을 따른다.

새 환경변수를 도입하면 서버의 환경변수 파일도 함께 갱신한다.

닉네임 인증은 외부 키가 필요 없다. 지도 기본 모드를 `demo`로 두면 외부 키 없이 전체 로컬 흐름을 실행할 수 있다.

실제 비밀값은 `.env.example`, 애플리케이션 설정, 문서와 Git에 커밋하지 않는다.
