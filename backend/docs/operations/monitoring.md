# 모니터링

- 상태: 애플리케이션·배포 설정 구현, AWS 적용 전

현재 예산에서는 구조화 로그로 장애 발생 시각과 원인을 찾는 것을 우선한다. CPU·메모리 대시보드와 알림은 로그 수집을 확인한 뒤 추가한다.

## 관찰 대상

- 가용성: health 상태와 요청 성공 여부
- 오류: 애플리케이션 기동 실패와 HTTP 5xx
- 성능: 요청 지연시간
- 프로세스: 애플리케이션 준비·종료·자동 재시작
- 자원: CPU와 메모리. 현재는 EC2 기본 메트릭만 사용하며 JVM 메트릭은 후속 작업으로 둔다

## 원칙

- 알림은 담당자가 행동할 수 있는 조건에만 설정한다.
- 로그에 비밀번호, 토큰, 개인정보와 전체 요청·응답 본문을 남기지 않는다.
- 관찰하려는 질문과 판단 기준을 수집 전에 정한다.
- 사실로 관찰한 값과 팀의 해석을 구분해 기록한다.

## 로그 구성

| 실행 환경       | 출력                  | 용도                           |
| --------------- | --------------------- | ------------------------------ |
| `local`, `test` | 사람이 읽는 콘솔 로그 | 개발과 테스트                  |
| `prod` 프로필   | 콘솔 + ECS JSON 파일  | dev·prod EC2와 CloudWatch 수집 |

dev와 prod EC2는 모두 Spring의 `prod` 프로필을 사용한다. `DEPLOYMENT_ENVIRONMENT`를 각각 `dev`, `prod`로 두어 JSON의 `service.environment`를 구분한다.

로그 파일은 다음과 같다.

| 파일                                        | 내용                                | 보존                                            |
| ------------------------------------------- | ----------------------------------- | ----------------------------------------------- |
| `/var/log/jachwi-sunbae/application.log`    | 애플리케이션·요청·예외 JSON         | 10MB 단위, 최대 14일·1GB                        |
| `/var/log/jachwi-sunbae/service-events.log` | systemd가 기록한 프로세스 종료 결과 | 종료당 한 줄을 누적하고 CloudWatch에서 7일 보존 |

요청 로그에는 `request_id`, `http_method`, `path`, `status`, `duration_ms`만 넣는다. 쿼리 문자열, Authorization 헤더, 요청·응답 본문은 기록하지 않는다. 애플리케이션 내부 예외 로그도 같은 `request_id`를 가지므로 요청 완료 로그와 연결할 수 있다.

`X-Request-Id`는 서버가 매 요청마다 새로 만들고 응답 헤더로 반환한다. 사용자가 전달한 값을 신뢰해 재사용하지 않는다.

## EC2 적용 전 준비

`/etc/jachwi-sunbae/app.env`에 `DEPLOYMENT_ENVIRONMENT`와 `LOG_PATH`를 환경에 맞게 추가한다.

배포의 `AfterInstall`이 로그 디렉터리와 `jachwi` 사용자의 쓰기 권한을 만든다. 배포 후 다음을 확인한다.

```bash
sudo systemctl status jachwi-sunbae.service
sudo journalctl -u jachwi-sunbae.service -n 200 --no-pager
sudo tail -n 20 /var/log/jachwi-sunbae/application.log
sudo tail -n 20 /var/log/jachwi-sunbae/service-events.log
```

## CloudWatch Logs 적용

### 1. 권한 확인

dev·prod EC2의 `ec2-project` instance role에 `CloudWatchAgentServerPolicy`와 동등한 권한이 필요하다. 팀이 role 정책을 바꿀 수 없다면 인프라 담당자에게 다음 권한을 요청한다.

- `logs:CreateLogGroup`
- `logs:CreateLogStream`
- `logs:PutLogEvents`
- `logs:PutRetentionPolicy`
- `logs:DescribeLogGroups`
- `logs:DescribeLogStreams`

권한 범위는 `/jachwi-sunbae/*` 로그 그룹으로 제한한다.

### 2. 로그 그룹 생성

CloudWatch Logs에서 다음 로그 그룹을 만들고 보존 기간을 7일로 설정한다.

| 환경 | 애플리케이션                      | 프로세스 종료                        |
| ---- | --------------------------------- | ------------------------------------ |
| dev  | `/jachwi-sunbae/dev/application`  | `/jachwi-sunbae/dev/service-events`  |
| prod | `/jachwi-sunbae/prod/application` | `/jachwi-sunbae/prod/service-events` |

부하 테스트 전후의 로그가 7일보다 오래 필요하면 이슈에 필요한 시각 범위를 기록한 뒤 해당 기간만 보존 기간을 늘린다.

### 3. Agent 설치

세션 관리자로 각 EC2에 접속해 설치한다. Amazon Linux 2023은 패키지 설치를 지원한다.

```bash
sudo yum install -y amazon-cloudwatch-agent
```

### 4. Agent 설정

dev EC2에서는 `/opt/aws/amazon-cloudwatch-agent/etc/jachwi-sunbae.json`을 다음과 같이 만든다. prod는 로그 그룹의 `/dev/`만 `/prod/`로 바꾼다.

```json
{
  "agent": {
    "region": "ap-northeast-2",
    "run_as_user": "root"
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/jachwi-sunbae/application.log",
            "log_group_name": "/jachwi-sunbae/dev/application",
            "log_stream_name": "{instance_id}-application",
            "retention_in_days": 7
          },
          {
            "file_path": "/var/log/jachwi-sunbae/service-events.log",
            "log_group_name": "/jachwi-sunbae/dev/service-events",
            "log_stream_name": "{instance_id}-service-events",
            "retention_in_days": 7
          }
        ]
      }
    }
  }
}
```

설정을 적용하고 상태를 확인한다.

```bash
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/jachwi-sunbae.json

sudo systemctl status amazon-cloudwatch-agent
sudo tail -n 100 /opt/aws/amazon-cloudwatch-agent/logs/amazon-cloudwatch-agent.log
```

## Logs Insights 조회

### 최근 5xx 요청

```text
fields @timestamp, request_id, http_method, path, status, duration_ms, message
| filter status >= 500
| sort @timestamp desc
| limit 100
```

### 요청 ID로 전체 흐름 추적

```text
fields @timestamp, `log.level`, `log.logger`, message, status, duration_ms
| filter request_id = "확인할-요청-ID"
| sort @timestamp asc
```

### 느린 요청

```text
fields @timestamp, request_id, http_method, path, status, duration_ms
| filter duration_ms >= 1000
| sort duration_ms desc
| limit 100
```

### 애플리케이션 재기동

```text
fields @timestamp, event_type, message
| filter event_type in ["application_ready", "application_stopping"]
| sort @timestamp desc
```

`service-events` 로그 그룹에서는 다음 쿼리로 비정상 종료를 확인한다.

```text
fields @timestamp, service_result, exit_code, exit_status
| filter event_type = "service_exit"
| sort @timestamp desc
```

## 로그로 판단하는 장애

| 관찰                                       | 우선 판단                           | 다음 확인                                   |
| ------------------------------------------ | ----------------------------------- | ------------------------------------------- |
| 5xx와 예외 스택이 같은 `request_id`로 존재 | 애플리케이션 처리 실패              | 첫 예외의 `error_type`과 cause              |
| `duration_ms`가 먼저 증가하고 5xx가 뒤따름 | 과부하 또는 하위 의존성 지연        | 같은 시각 EC2 CPU와 RDS 상태                |
| DB 연결 예외가 여러 요청에서 반복          | DB 연결·권한·가용성 문제            | RDS 상태, 보안 그룹, connection pool        |
| `service_result=oom-kill`                  | Linux OOM killer가 프로세스를 종료  | EC2 메모리와 JVM 최대 메모리                |
| `exit_code=killed`, `exit_status=KILL`     | 강제 종료 또는 OOM 가능성           | 같은 시각 커널 로그와 실행한 장애 주입 명령 |
| `application_stopping` 뒤 종료             | SIGTERM 기반 정상 종료              | 배포 또는 운영자 재시작 기록                |
| 종료 이벤트 뒤 `application_ready`         | systemd 자동 재시작 성공            | 두 시각의 차이와 health 응답                |
| 애플리케이션·종료 로그가 동시에 끊김       | 인스턴스·네트워크·Agent 장애 가능성 | EC2 status check와 CloudWatch Agent 상태    |

로그만으로 CPU 고갈, 네트워크 단절, AWS 물리 호스트 장애를 항상 확정할 수는 없다. 로그가 끊긴 경우에는 EC2의 `StatusCheckFailed_System`, `StatusCheckFailed_Instance`, CPU 지표를 함께 확인한다.

## dev 장애 주입

prod와 공유하는 RDS·ALB·S3 자체를 중지하거나 보안 그룹을 변경하지 않는다. 먼저 dev에서 영향이 작은 시나리오부터 한 번씩 실행하고 시작·종료 시각을 이슈에 기록한다.

### HTTP 오류와 요청 추적

존재하지 않는 경로와 인증 실패 요청을 보내 `X-Request-Id`, 상태 코드와 요청 로그가 일치하는지 확인한다.

```bash
curl -i https://dev-api.jachwi-sunbae.kr/not-existing
curl -i https://dev-api.jachwi-sunbae.kr/api/properties
```

### 프로세스 비정상 종료와 자동 복구

dev EC2에서만 실행한다.

```bash
STARTED_AT="$(date -u +%FT%TZ)"
sudo systemctl kill --signal=SIGKILL jachwi-sunbae.service
sudo journalctl -u jachwi-sunbae.service --since "${STARTED_AT}" --no-pager
curl -fsS https://dev-api.jachwi-sunbae.kr/actuator/health
```

`service-events.log`에 `exit_status=KILL`이 남고 5초 뒤 서비스가 재시작되어 health가 `UP`이어야 한다.

### 부하 테스트

100만 요청을 즉시 보내지 않는다. 별도 부하 발생기에서 1천, 1만, 10만 순서로 올리며 오류율과 지연시간을 확인한 뒤 다음 단계로 진행한다. 실제 데이터 변경 API, 로그인 API와 공유 RDS를 집중 호출하지 않는다. 최종 100만 요청 시나리오와 도구는 후속 이슈에서 결정한다.

## 자동 복구 범위

systemd는 EC2 자체가 중지되거나 AWS 호스트에 장애가 발생한 경우 복구할 수 없다. `t4g`는 CloudWatch action based recovery 지원 대상이다. 로그 수집을 확인한 뒤 EC2 콘솔에서 각 인스턴스의 `StatusCheckFailed_System`이 1분 간격으로 2회 실패하면 `Recover this instance`를 실행하는 Alarm을 설정한다. 이 복구는 시스템 status check 장애만 대상으로 하며 애플리케이션 오류나 `StatusCheckFailed_Instance`를 복구하지 않는다.
