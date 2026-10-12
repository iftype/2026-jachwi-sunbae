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
| `LOG_PATH`                   | `./logs`                | `prod` 프로필에서 JSON 로그 파일을 저장할 디렉터리                                       |

## 사용 방법

`backend`에서 개인 파일을 생성한다.

```bash
cp .env.example .env
```

Docker Compose는 같은 디렉터리의 `.env`를 자동으로 읽는다. Spring Boot를 직접 실행할 때는 셸 또는 실행 환경에 필요한 값을 주입한다.

## dev·prod 프로필

dev와 prod EC2는 모두 `SPRING_PROFILES_ACTIVE=prod`로 기동하며 `/etc/jachwi-sunbae/app.env`에서 환경변수를 읽는다. 애플리케이션은 80 포트를 직접 사용한다.
실제 값은 환경마다 분리하고 파일 권한은 `root:root`, `0600`으로 유지한다.

| 설정                       | dev                            | prod                           |
| -------------------------- | ------------------------------ | ------------------------------ |
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

`MAP_NEARBY_PROVIDER`를 빠뜨리면 오류 없이 `demo` 주변 시설 (가짜 데이터)로 동작하므로 dev·prod에는 반드시 `kakao`를 넣는다.
Kakao Developers 앱에 허용 IP를 설정했다면 서버가 외부로 나가는 IP (VPC NAT 게이트웨이 IP)를 등록해야 한다.

AWS S3는 EC2 `ec2-project` instance role로 접근하므로 `PHOTO_STORAGE_ENDPOINT`, `PHOTO_STORAGE_ACCESS_KEY`,
`PHOTO_STORAGE_SECRET_KEY`를 EC2에 두지 않는다. 이 세 값은 로컬 MinIO에만 사용한다. 프론트엔드에는 지도 화면용 공개 Naver Maps Client ID만 빌드 타임에 주입한다.
백엔드는 네이버 API를 사용하지 않는다.

`src/main/resources/db/init/001-schema.sql`과 `002-seed.sql`은 로컬 Docker 초기화와 통합 테스트에서 공유하는 기준 스키마와 시스템 체크 항목이다.
`docker/mysql/init/003-bus-stops-sample.sql`은 로컬 Docker 초기화 전용 버스정류장 샘플이며 애플리케이션 JAR에 포함하지 않는다.
애플리케이션은 기동 중 스키마를 변경하지 않는다.
dev·prod RDS를 이 기준선으로 전환할 때는 자동 백업의 최신 복구 지점을 먼저 확인하고, 별도의 데이터 이관 절차로 기존 회원·매물 데이터를 보존해야 한다.

새 환경변수를 도입하면 서버의 환경변수 파일도 함께 갱신한다.

닉네임 인증은 외부 키가 필요 없다. 지도 기본 모드를 `demo`로 두면 외부 키 없이 전체 로컬 흐름을 실행할 수 있다.

실제 비밀값은 `.env.example`, 애플리케이션 설정, 문서와 Git에 커밋하지 않는다.
