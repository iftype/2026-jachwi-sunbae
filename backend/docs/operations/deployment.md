# 배포

백엔드는 GitHub Actions로 검증하고 AWS CodePipeline·CodeDeploy로 배포한다. dev·prod는 빌드 명령과 배포 훅을 공유하며, 소스 브랜치·배포 그룹·환경변수로 구분한다.

## 1. 배포 환경과 요청 경로

### 전체 배포 흐름

작업 브랜치에서 PR을 생성하고 GitHub Actions의 필수 검사를 통과한 뒤 병합한다. **`develop` 병합은 dev 배포, `main` 병합은 prod 배포를 시작한다.** dev에서 검증한 변경을 `main`에 반영하면 prod 파이프라인이 같은 방식으로 빌드·배포한다.

```text
작업 브랜치 → PR → GitHub Actions 필수 검사 통과
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   develop 병합               main 병합
        │                       │
 jachwi-sunbae-dev-line    jachwi-sunbae-line
        │                       │
 Source: develop          Source: main
        │                       │
 Commands: Corretto 21 · bootJar · 소스 SHA 기록
        │                       │
 환경별 BuildArtifact → S3 아티팩트 버킷
        │                       │
 CodeDeploy               CodeDeploy
 jachwi-sunbae-dev-group   jachwi-sunbae-codeDeploy-group
        │                       │
 dev 태그의 ASG EC2        prod 태그의 EC2
        └───────────┬───────────┘
                    ▼
 ApplicationStop → DownloadBundle → BeforeInstall → Install
                    ▼
 AfterInstall: 배포 환경 선택 → Vault 설정 다운로드 → 유닛 설치
                    ▼
 ApplicationStart: systemd restart
                    ▼
 ValidateService: 서비스 active · health UP · 배포 SHA 일치
                    ▼
 배포 성공 확인 → ALB 대상 상태와 환경별 API 응답 확인
```

GitHub Actions는 검사, CodePipeline은 소스 조회·빌드·배포 연결, CodeDeploy 에이전트는 EC2에서 산출물 설치와 훅 실행을 담당한다. `DownloadBundle`과 `Install`은 CodeDeploy가 수행하는 단계이며 별도 사용자 스크립트가 아니다. 첫 배포에서는 `ApplicationStop`이 실행되지 않는다.

### 환경별 파이프라인과 대상

| 환경 | 브랜치    | CodePipeline             | CodeDeploy 배포 그룹             | EC2 선택 태그                     |
| ---- | --------- | ------------------------ | -------------------------------- | --------------------------------- |
| dev  | `develop` | `jachwi-sunbae-dev-line` | `jachwi-sunbae-dev-group`        | `DeployTarget=jachwi-sunbae-dev`  |
| prod | `main`    | `jachwi-sunbae-line`     | `jachwi-sunbae-codeDeploy-group` | `DeployTarget=jachwi-sunbae-prod` |

dev는 `jachwi-sunbae-dev-asg`, prod는 현재 단일 EC2를 사용한다. CodeDeploy가 태그로 대상을 선택하므로 새 인스턴스에도 환경에 맞는 태그를 지정한다.

### 사용자 요청 경로

```text
클라이언트 HTTPS 요청 → 공유 ALB:443 → 호스트 규칙
  ├─ dev-api.jachwi-sunbae.kr → dev 대상 그룹 → dev EC2:80
  └─ 기본 작업              → prod 대상 그룹 → prod EC2:80
```

공유 ALB의 443 리스너는 호스트로 요청을 나누며 인증서는 SNI로 함께 연결한다.

| 요청                                    | 대상 그룹                |
| --------------------------------------- | ------------------------ |
| `dev-api.jachwi-sunbae.kr`              | `jachwi-sunbae-dev-tg`   |
| 기본 작업 — `api.jachwi-sunbae.kr` 포함 | `jachwi-sunbe-tg` (prod) |

조건에 해당하지 않는 요청도 prod로 간다. dev 규칙을 수정할 때 기본 작업을 바꾸지 않는다.

## 2. CI와 빌드 산출물

GitHub Actions는 PR과 `main`·`develop` push에서 `clean build`를 실행한다. 병합 전에 필수 검사를 통과해야 하므로 배포 빌드는 `clean bootJar -x test`로 JAR를 만든다.

팀은 AWS 액세스 키와 서비스 역할 정책을 직접 관리할 수 없어 AWS 파이프라인을 사용한다. 별도 CodeBuild 프로젝트는 `SourceArtifact` 읽기 권한 문제로 사용하지 않고, 파이프라인 서비스 역할을 사용하는 `Commands`를 사용한다. **빌드 명령은 콘솔에 있으므로 설정 변경 시 문서도 갱신한다.**

Corretto 21을 준비하고 소스 SHA를 애플리케이션 빌드 정보와 `deployment-revision.txt`에 기록한다.

| 설정                     | 값                                             |
| ------------------------ | ---------------------------------------------- |
| Source 변수 네임스페이스 | `SourceVariables`                              |
| Build 환경변수           | `SOURCE_COMMIT_ID=#{SourceVariables.CommitId}` |
| 아티팩트 버킷            | `techcourse-project-2026-artifacts`            |

```bash
REVISION="${SOURCE_COMMIT_ID:?source revision is missing}"
printf '%s' "${REVISION}" | grep -Eq '^[0-9a-f]{40}$'
SOURCE_COMMIT_ID="${REVISION}" ./backend/gradlew -p backend --no-daemon --max-workers=1 clean bootJar -x test
printf '%s\n' "${REVISION}" > deployment-revision.txt
```

실행 가능한 JAR를 `app.jar`로 복사하고 `backend/deploy/`를 아티팩트 최상단에 배치한다. `BuildArtifact`에는 `app.jar`, `deployment-revision.txt`, `appspec.yml`, `jachwi-sunbae.service`, `scripts/**/*`가 필요하다. `appspec.yml`의 위치나 출력 목록이 잘못되면 배포가 실패한다.

## 3. 배포 훅과 완료 조건

[appspec.yml](../../deploy/appspec.yml)이 순서와 제한 시간을 정의한다. 배포 경로는 `/opt/jachwi-sunbae`다.

| 훅                 | 처리                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `ApplicationStop`  | 기존 서비스를 중지한다. 직전 리비전의 스크립트를 사용하며 첫 배포에는 실행되지 않는다       |
| `BeforeInstall`    | 배포 디렉터리를 비운다                                                                      |
| `AfterInstall`     | 환경별 Vault 도구·인증서와 `app.env`를 준비하고 사용자·권한 확인 후 systemd 유닛을 설치한다 |
| `ApplicationStart` | `systemctl restart`로 새 애플리케이션을 실행한다                                            |
| `ValidateService`  | 서비스 실행, `health=UP`, 실행 SHA와 배포 SHA 일치를 확인한다                               |

과거 서비스 중지가 누락되어 `start`가 옛 프로세스를 유지하고, 그 health 응답으로 배포가 성공 처리된 경험이 있다. 이를 방지하려고 **명시적 restart와 SHA 비교**를 함께 사용한다.

실행 SHA는 `/actuator/info`의 `build.commit`, 배포 SHA는 `deployment-revision.txt`에서 확인한다. SHA 불일치, 배포 SHA 파일 누락·형식 오류는 검증 실패로 처리한다.

## 4. EC2 실행 환경과 프로세스 관리

EC2에는 Java 21, 실행 사용자 `jachwi`, CodeDeploy 에이전트와 배포 디렉터리가 필요하다. Vault 준비 스크립트는 Java·사용자·CodeDeploy 에이전트를 설치하지 않는다.

[jachwi-sunbae.service](../../deploy/jachwi-sunbae.service)는 환경변수 파일을 읽어 `jachwi` 사용자로 실행한다. dev·prod 모두 `SPRING_PROFILES_ACTIVE=prod`를 사용한다.

### 포트와 파일 권한

애플리케이션은 **80 포트**를 사용한다. ALB에서 앱으로 전달하는 경로에 8080이 열려 있지 않아 80을 사용하며, 비루트 사용자에게 `CAP_NET_BIND_SERVICE`를 부여한다.

포트 변경 시 `application-prod.yml`, `validate.sh`의 확인 URL, ALB 대상 그룹을 함께 변경한다. 대상 그룹의 포트는 생성 후 변경할 수 없다.

| 경로                                 | 권한·용도                                           |
| ------------------------------------ | --------------------------------------------------- |
| `/etc/jachwi-sunbae/app.env`         | `0600 root:root`. systemd가 읽는 환경변수           |
| `/etc/jachwi-sunbae/vault-ca.crt`    | `0644 root:root`. Vault TLS 검증용 공개 인증서      |
| `/etc/jachwi-sunbae/vault-ec2-nonce` | `0600 root:root`. 인스턴스별 재인증 값              |
| `/var/log/jachwi-sunbae`             | `0750 jachwi:jachwi`. 애플리케이션·종료 이벤트 로그 |

### 자동 재시작

비정상 종료 시 systemd가 5초 후 재시작한다. 5분 동안 5번 연속 기동 실패 시 재시작을 제한하며 종료 결과는 `service-events.log`에 기록한다. 정상 배포 종료는 실패로 취급하지 않는다.

원인을 해결한 뒤 제한을 해제한다.

```bash
sudo systemctl reset-failed jachwi-sunbae.service
sudo systemctl start jachwi-sunbae.service
```

EC2 자체의 중지·종료는 systemd로 복구할 수 없으며 ASG 구성에서 처리한다.

## 5. Vault 환경변수 관리

환경변수가 AMI에 고정되면 새 코드와 이전 설정의 불일치로 ASG 복구 배포가 반복 실패할 수 있다. 설정은 별도 Vault 서버에 저장하고 앱 EC2가 배포 시 자신의 신원으로 가져온다.

### 구성과 인증

Vault 주소는 `https://10.0.100.209:8200`이다. KV v2의 `app_env` 필드에 환경변수 파일 전체를 저장한다.

| 환경 | 스크립트 인자 | 인증 역할 / 읽기 정책              | 비밀값 경로                 |
| ---- | ------------- | ---------------------------------- | --------------------------- |
| dev  | `dev`         | `jachwi-dev` / `jachwi-dev-read`   | `secret/jachwi-sunbae/dev`  |
| prod | `prod`        | `jachwi-prod` / `jachwi-prod-read` | `secret/jachwi-sunbae/prod` |

AWS EC2 인증으로 계정·리전·VPC·서브넷과 허용 인스턴스 ID를 검사한다. 앱에는 해당 환경의 읽기만 허용하고 토큰은 최대 5분으로 제한한다. 공용 `ec2-project` IAM 역할만으로 팀을 구분하지 않으며, 공용 AWS 계정의 관리자 권한까지 격리하는 구성은 아니다.

dev 허용 ID는 Vault 서버의 `jachwi-sync-dev-asg.timer`가 ASG의 실행·시작 중 인스턴스 목록으로 약 30초마다 갱신한다. prod는 현재 `i-0ee91aab315b53005`에 제한하므로 교체 시 허용 ID를 갱신해야 한다.

### 동작에 필요한 것

- 앱 EC2 → Vault TCP 8200 통신과 앱 EC2의 IMDSv2 접근
- Vault의 환경별 비밀값·인증 역할·읽기 정책 등록
- Amazon Linux 2023과 공식 패키지 저장소로의 HTTPS 접근
- 배포 산출물의 공개 인증서. 환경변수·Vault 토큰·TLS 개인키·인스턴스별 nonce는 포함하지 않는다
- 초기화와 unseal이 완료된 Vault. 현재 단일 서버 구성은 재시작 후 수동 unseal이 필요하다

### 배포 흐름과 설정 변경

```text
AfterInstall
  → 배포 그룹으로 dev / prod 선택
  → prepare_vault.sh: CLI·도구 설치, 공개 인증서 검증·배치
  → fetch_env.sh <환경>: IMDSv2 신원 조회 → Vault 인증
  → app.env 임시 다운로드 → 필수 키 검사 → 기존 파일 교체
ApplicationStart → restart
ValidateService → health와 SHA 확인
```

[prepare_vault.sh](../../deploy/scripts/prepare_vault.sh)는 Vault CLI `2.1.1`, `jq`, `openssl`, `curl`, `timeout`을 준비한다. [fetch_env.sh](../../deploy/scripts/fetch_env.sh)는 `dev` 또는 `prod` 인자 하나만 허용한다. 각 스크립트는 최대 180초, `AfterInstall`은 420초로 제한하며 인증은 최대 6회 재시도한다.

파일 교체 전 `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET` 항목을 검사한다. 실패 시 기존 파일을 보존하고 배포를 중단한다. 앞선 훅에서 앱이 중지됐을 수 있으므로 파일 보존이 무중단을 보장하지는 않는다.

Vault 값 변경은 실행 중인 앱에 즉시 반영되지 않는다. 이 리비전 배포 후 파일을 갱신하고 성공했을 때만 재시작한다. prod에서는 인자를 `prod`로 바꾼다.

```bash
sudo timeout --kill-after=5s 180s bash /opt/jachwi-sunbae/scripts/fetch_env.sh dev \
  && sudo systemctl restart jachwi-sunbae.service
```

`app.env` 삭제나 `restart`만으로 다운로드가 실행되지는 않는다.

**2026-10-07 확인 상태:** dev는 새 ASG 인스턴스의 다운로드·자동 배포·ALB health를 확인했다. prod는 비밀값 등록·원본 일치·dev 읽기 및 prod 쓰기 차단을 확인했다. 이 리비전의 실제 prod CodeDeploy, CLI가 없는 EC2의 패키지 설치 경로, Vault 서버 장애 복구는 아직 검증하지 않았다.

## 6. AMI와 ASG 복구

AMI는 Java·에이전트 등 기반 실행 환경을 제공하고 CodeDeploy가 애플리케이션과 Vault 설정을 준비한다. 환경변수 변경만으로 AMI를 다시 만들 필요는 없다.

AMI 생성은 서비스 중인 EC2 대신 분리한 작업용 인스턴스에서 진행한다. 앱 자동 시작을 해제하고 `app.env`·백업·인증 nonce·비밀값이 포함될 수 있는 작업 흔적을 제외한다. 기존 검증은 파일 경로에서의 제외이며 과거 디스크 데이터의 완전 소거까지 확인한 것은 아니다.

2026-10-07 dev AMI `ami-010ffe62c648da620`과 시작 템플릿 `jachwi-sunbae-dev-lt` 버전 `10`의 복구 배포를 확인했다. ASG는 `$Latest` 대신 검증한 버전을 명시한다. 확인 가능한 배포는 [CodeDeploy d-NAY58TW7L](https://ap-northeast-2.console.aws.amazon.com/codesuite/codedeploy/deployments/d-NAY58TW7L?region=ap-northeast-2)이다.

새 EC2는 Vault 허용 목록 반영과 CodeDeploy 배포에 성공한 후 앱을 시작한다. EC2·EBS·AMI·스냅샷에는 `Service=techcourse`, `Role=techcourse-etc`, `ProjectTeam=jachwi-sunbae` 태그를 지정한다.

기존 dev 복구용 `i-03524d449110c0d08`과 AMI 작업용 `i-08b93ed167aeb8b26`은 중지 상태로 보관 중이다. EBS 비용은 계속 발생하며 재시작만으로 ASG나 Vault 허용 목록에 복귀하지 않는다. 복구 시 [롤백 문서](rollback.md)를 함께 참고한다.

## 7. DB·기능 설정 변경 시 사전 확인

배포 중 RDS 스키마는 자동 변경하지 않는다. `db/init`은 빈 로컬 MySQL의 기준선이므로 기존 RDS에 직접 실행하지 않는다.

스키마 전환은 백업 → 데이터 덤프 → 새 스키마 생성 → 데이터 적재 → 무결성 검증을 별도 수행하고 배포 이슈에 기록한다. prod 전환은 dev 검증과 보관 데이터 확인 후 진행한다. 배포 직전 최신 자동 백업 복구 지점과 확인 시각을 기록한다.

MVP1 첫 dev 배포에서는 다음을 확인한다.

1. RDS 백업과 앱 DB 계정의 `SELECT`, `INSERT`, `UPDATE`, `DELETE` 권한을 확인한다.
2. 아래 두 쿼리 결과가 없어야 한다. 문제가 있으면 데이터를 임의 삭제하지 않고 사진 관계를 확인한다.

   ```sql
   SELECT property_id, COUNT(*) AS representative_count
   FROM main_property_photos
   GROUP BY property_id
   HAVING COUNT(*) > 1;

   SELECT main_photo.id, main_photo.property_id, main_photo.property_photos_id,
          photo.property_id AS actual_photo_property_id
   FROM main_property_photos AS main_photo
   JOIN property_photos AS photo ON photo.id = main_photo.property_photos_id
   WHERE main_photo.property_id <> photo.property_id;
   ```

3. Vault에 dev DB·JWT·CORS·지도 공급자 인증 정보·S3 접두사를 준비한다. 정적 AWS 키는 두지 않는다.
4. `bus_stops` 테이블과 전국 정류장 데이터, 앱 DB 계정의 조회 권한을 확인한다. 준비되지 않았다면 [버스정류장 데이터 적재](#버스정류장-데이터-적재)를 애플리케이션 배포 전에 완료한다.
5. 프론트 dev Commands에 `API_BASE_URL=https://dev-api.jachwi-sunbae.kr`, `MAP_PROVIDER_MODE`, 지도 공급자 공개 키, 운영과 같은 `POSTHOG_PROJECT_TOKEN`, `POSTHOG_HOST=https://us.i.posthog.com`을 설정한다. PostHog는 `environment=development`로 구분한다.

### 버스정류장 데이터 적재

| 항목                   | 기준                                                        |
| ---------------------- | ----------------------------------------------------------- |
| 스냅샷                 | `국토교통부_전국 버스정류장 위치정보_20251031.csv`          |
| 원본 행 / 예상 적재 행 | 227,065 / 227,053 (빈 좌표 5행, 국내 범위 밖 좌표 7행 제외) |
| 갱신 주기              | 연 1회 수동. 새 스냅샷이 공개되면 같은 절차로 다시 적재한다 |

애플리케이션은 `bus_stops`를 조회만 한다. 테이블이 없으면 교통 조회가 실패하므로 **애플리케이션 배포 전에 테이블 생성과 데이터 적재를 완료한다.**
`develop` 병합은 dev 배포를 시작하므로 dev DB를 먼저 준비한다. dev 검증 후 prod DB도 준비하고 `main`으로 승격한다.

1. 대상 환경의 DB와 최신 자동 백업 복구 지점을 확인하고, 식별자와 확인 시각을 배포 이슈에 기록한다.
2. 처음 적재할 때만 관리자 계정으로 테이블을 만든다. [기준 스키마](../../src/main/resources/db/init/001-schema.sql) 전체가 아니라 `bus_stops`의 `CREATE TABLE` 문만 실행한다. 앱 DB 계정에는 `CREATE` 권한을 추가하지 않는다. 이미 테이블이 있으면 구조와 기존 데이터의 스냅샷을 확인한다.
3. 저장소 루트에서 CSV (EUC-KR)로 적재 SQL을 만든다. 전체 SQL은 약 20MB이므로 저장소 밖에 두고 커밋하지 않는다. 전국 데이터를 만들 때는 지역 샘플용 `--around` 옵션을 사용하지 않는다. 출력의 적재 행 수와 제외 행 목록을 확인한다.

   ```bash
   python3 backend/scripts/bus-stops/generate_bus_stops_sql.py "<CSV 경로>" --output /tmp/bus-stops.sql
   ```

4. RDS에 접속할 수 있는 해당 환경의 EC2로 SQL 파일을 옮긴다. 아래 변수에는 대상 환경의 접속값을 사용하고, `DB_USERNAME`에는 적재에 필요한 `DELETE`, `INSERT` 권한이 있는 계정을 지정한다. 비밀번호는 `-p` 입력 요청에 입력한다.

   ```bash
   mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USERNAME" -p \
     --default-character-set=utf8mb4 "$DB_NAME" < /tmp/bus-stops.sql
   ```

   SQL은 한 트랜잭션 안에서 기존 정류장을 지우고 다시 넣는다. InnoDB에서 커밋 전 오류로 배치 실행이 중단되고 연결이 종료되면 미커밋 변경은 롤백된다. 오류 후에도 실행을 계속하는 `--force` 옵션은 사용하지 않으며, 실행이 실패하면 원인과 DB 상태를 확인한 뒤 재시도한다.

5. 실제 앱 DB 계정으로 접속해 조회 권한과 적재 결과를 확인한다. 위 스냅샷은 두 값 모두 `227053`이어야 한다. 사용한 스냅샷과 결과를 배포 이슈에 기록한다.

   ```sql
   SELECT COUNT(*) AS total_count,
          COUNT(DISTINCT node_id) AS unique_node_count
   FROM bus_stops;
   ```

6. 애플리케이션을 배포한 뒤 서비스 상태·health·실행 SHA와 실제 교통 조회를 확인한다. 같은 좌표에서 500m·1km·2km 반경을 각각 요청해 선택 반경이 반영되는지 확인한다.
7. 새 버전의 동작을 확인한 뒤, 해당 환경의 Vault `app_env`에서 더 이상 쓰지 않는 `BUS_STOP_PROVIDER`, `DATA_GO_KR_SERVICE_KEY` 두 줄을 삭제하고 다른 설정은 유지한다. [Vault 환경변수 관리](#5-vault-환경변수-관리)에 따라 `fetch_env.sh dev` 또는 `fetch_env.sh prod`로 내려받고 성공했을 때 재시작한다. 서비스 중인 인스턴스별로 적용과 정상 동작을 확인한다. 서버의 `/etc/jachwi-sunbae/app.env`만 직접 수정하면 다음 배포에서 Vault 값으로 덮어써진다.

데이터만 갱신할 때는 백업을 확인한 뒤 테이블 생성은 건너뛰고 3~5번을 진행한다. 데이터 갱신 자체에는 애플리케이션 재시작이 필요 없다. 적재한 스냅샷이 바뀌면 위 표도 함께 고친다.

## 8. 배포 확인과 로그

서비스 상태·health·실행 SHA를 함께 확인한다.

```bash
sudo systemctl is-active jachwi-sunbae.service
curl --fail --silent --show-error http://127.0.0.1/actuator/health | jq
curl --fail --silent --show-error http://127.0.0.1/actuator/info | jq '.build.commit'
cat /opt/jachwi-sunbae/deployment-revision.txt
```

실패 원인은 애플리케이션·종료 이벤트·CodeDeploy 로그에서 확인한다.

```bash
sudo journalctl -u jachwi-sunbae.service -f
sudo tail -f /var/log/jachwi-sunbae/application.log
sudo tail -f /var/log/jachwi-sunbae/service-events.log
sudo ls /opt/codedeploy-agent/deployment-root/deployment-logs/
```

결과는 관련 GitHub 이슈 또는 PR에 기록한다. 지표·로그 구성은 [모니터링 문서](monitoring.md), 장애 대응은 [장애 대응 문서](incident-response.md)를 참고한다.

배포 스크립트 변경 시 다음 검사를 실행한다.

```bash
bash -n backend/deploy/scripts/prepare_vault.sh
bash -n backend/deploy/scripts/fetch_env.sh
bash -n backend/deploy/scripts/after_install.sh
git diff --check
```
