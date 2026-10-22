# 모니터링

- 상태: dev·prod 애플리케이션·서비스 종료 로그 수집, 환경별 5종 경보 및 운영 대시보드 적용, 메트릭 노출 구성, dev·prod 공통 GC 로그·Thread Dump 수집 도구 배포

현재 예산에서는 구조화 로그로 장애 발생 시각과 원인을 찾고, 기존 CloudWatch·ALB 지표로 서비스 상태를 확인한다. 부하 테스트용 perf 서버에서는 Prometheus로 JVM·HTTP·HikariCP 메트릭을 확인한다. dev·prod의 JVM 지표 수집은 후속 작업이다.

## 운영 대시보드

[CloudWatch 자취선배 운영 대시보드](https://ap-northeast-2.console.aws.amazon.com/cloudwatch/home?region=ap-northeast-2#dashboards/dashboard/jachwi-sunbae-operations)는 서울 리전의 dev·prod를 한 화면에서 비교한다. 기본 조회 범위는 최근 6시간이다.

| 영역          | 위젯명                           | 확인할 내용                                         |
| ------------- | -------------------------------- | --------------------------------------------------- |
| 경보 상태     | dev 경보 상태                    | dev의 HTTP 5xx·서비스 종료·CPU·대상 그룹 경보 상태  |
| 경보 상태     | prod 경보 상태                   | prod의 HTTP 5xx·서비스 종료·CPU·대상 그룹 경보 상태 |
| 오류          | HTTP 5xx 발생 수 (5분)           | 애플리케이션 요청 로그의 환경별 5xx 합계            |
| 오류          | ALB 대상 5xx 응답 수 (5분)       | ALB 대상 그룹의 환경별 5xx 합계                     |
| 오류          | 최근 HTTP 5xx 요청 (dev + prod)  | 최근 요청의 시각·환경·요청 ID·경로                  |
| 가용성        | ALB 정상 대상 수 (1분 최솟값)    | dev·prod 대상 그룹의 정상 대상 수                   |
| 트래픽·성능   | ALB 요청 수 (5분 합계)           | 환경별 대상 그룹에 전달된 요청 수                   |
| 트래픽·성능   | ALB 대상 응답 시간 p95 (초)      | 환경별 대상 그룹의 응답 시간 95백분위수             |
| 프로세스·자원 | 서비스 비정상 종료 수 (1분)      | 환경별 서비스 비정상 종료 건수                      |
| 프로세스·자원 | EC2 CPU 사용률 (ASG별, 5분 평균) | 환경별 Auto Scaling 그룹의 평균 CPU 사용률          |

ALB 요청 수는 대상으로 전달된 요청만 집계한다. 트래픽이 없는 구간의 요청 수·응답 시간·5xx 그래프에는 데이터가 없을 수 있다. 대시보드의 경보 상태와 실제 요청 오류는 함께 확인한다.

## 경보

2026-10-01 기준, dev·prod에 아래 5종의 경보를 같은 조건으로 설정했다. 모든 경보는 경보 진입과 정상 복귀를 각 환경의 `jachwi-sunbae-{dev|prod}-ops-alerts` SNS 주제에 알린다.

| 관찰 대상          | dev 경보                                                                                                                                                          | prod 경보                                                                                                                                                           | 발동 조건                                              | 누락 데이터 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------- |
| HTTP 5xx           | [`jachwi-dev-http-5xx`](https://ap-northeast-2.console.aws.amazon.com/cloudwatch/home?region=ap-northeast-2#alarmsV2:alarm/jachwi-dev-http-5xx)                   | [`jachwi-prod-http-5xx`](https://ap-northeast-2.console.aws.amazon.com/cloudwatch/home?region=ap-northeast-2#alarmsV2:alarm/jachwi-prod-http-5xx)                   | `Http5xxCount` 5분 합계 ≥ 5, 1/1                       | 정상 취급   |
| 서비스 비정상 종료 | [`jachwi-dev-service-failure`](https://ap-northeast-2.console.aws.amazon.com/cloudwatch/home?region=ap-northeast-2#alarmsV2:alarm/jachwi-dev-service-failure)     | [`jachwi-prod-service-failure`](https://ap-northeast-2.console.aws.amazon.com/cloudwatch/home?region=ap-northeast-2#alarmsV2:alarm/jachwi-prod-service-failure)     | `ServiceFailureCount` 1분 합계 ≥ 1, 1/1                | 정상 취급   |
| CPU 사용률         | [`jachwi-dev-cpu-high`](https://ap-northeast-2.console.aws.amazon.com/cloudwatch/home?region=ap-northeast-2#alarmsV2:alarm/jachwi-dev-cpu-high)                   | [`jachwi-prod-cpu-high`](https://ap-northeast-2.console.aws.amazon.com/cloudwatch/home?region=ap-northeast-2#alarmsV2:alarm/jachwi-prod-cpu-high)                   | ASG `CPUUtilization` 5분 평균 ≥ 80%, 3/3               | 정상 취급   |
| 정상 대상 없음     | [`jachwi-dev-no-healthy-target`](https://ap-northeast-2.console.aws.amazon.com/cloudwatch/home?region=ap-northeast-2#alarmsV2:alarm/jachwi-dev-no-healthy-target) | [`jachwi-prod-no-healthy-target`](https://ap-northeast-2.console.aws.amazon.com/cloudwatch/home?region=ap-northeast-2#alarmsV2:alarm/jachwi-prod-no-healthy-target) | ALB 대상 그룹 `HealthyHostCount` 1분 최솟값 < 1, 2/2   | 장애 취급   |
| 비정상 대상 감지   | [`jachwi-dev-unhealthy-target`](https://ap-northeast-2.console.aws.amazon.com/cloudwatch/home?region=ap-northeast-2#alarmsV2:alarm/jachwi-dev-unhealthy-target)   | [`jachwi-prod-unhealthy-target`](https://ap-northeast-2.console.aws.amazon.com/cloudwatch/home?region=ap-northeast-2#alarmsV2:alarm/jachwi-prod-unhealthy-target)   | ALB 대상 그룹 `UnHealthyHostCount` 1분 최솟값 ≥ 1, 2/2 | 정상 취급   |

HTTP 5xx는 각 환경의 `/jachwi-sunbae/{dev|prod}/application` 로그 그룹에 `{ $.status >= 500 }` 패턴의 `jachwi-{dev|prod}-http-5xx` 지표 필터를 둔다. 요청 로그의 `status`가 500 이상이면 `JachwiSunbae/{Dev|Prod} / Http5xxCount`에 1을 더하고, 일치하지 않는 로그가 들어오면 기본값 0을 게시한다. 5분에 1~4건의 5xx는 경보가 울리지 않으며, 경보가 정상이라고 해서 요청이나 로그 수집이 정상이라는 뜻도 아니다. 로그 수집 중단과 대상 그룹의 정상 호스트 수는 별도 지표로 판단한다.

prod HTTP 5xx 지표 필터는 생성 이후 수집된 로그에만 적용된다. 생성 전 로그를 소급 집계하지 않는다. prod SNS 주제에는 확인된 구독 1개가 있다. 실제 경보 메일 수신은 이후 경보 전환 기록과 팀 메일함을 함께 확인한다.

서비스 비정상 종료는 각 환경의 `/jachwi-sunbae/{dev|prod}/service-events` 로그 그룹에 `{ $.event_type = "service_exit" && $.service_result != "success" }` 패턴의 지표 필터를 둔다. 필터 이름은 `jachwi-{dev|prod}-service-failure`, 지표는 `JachwiSunbae/{Dev|Prod} / ServiceFailureCount`이며 일치 시 1, 기본값 0, 단위는 `Count`다. prod 필터도 생성 전 로그에는 소급 적용되지 않는다.

CPU 경보는 인스턴스 ID 대신 `jachwi-sunbae-{dev|prod}-asg`를 차원으로 사용한다. ALB 경보는 공통 `jachwi-sunbae-alb`와 환경별 대상 그룹(`jachwi-sunbae-dev-tg`, `jachwi-sunbae-tg`)을 함께 사용한다. 경보의 설정과 SNS 연결은 콘솔에서 확인했으며, 실제 장애에 따른 알림 수신 여부는 별도 검증이 필요하다.

## 관찰 대상

- 가용성: health 상태와 요청 성공 여부
- 오류: 애플리케이션 기동 실패와 HTTP 5xx
- 성능: 요청 지연시간
- 프로세스: 애플리케이션 준비·종료·자동 재시작
- 자원: CPU와 메모리. dev·prod는 EC2 기본 메트릭만 사용하며 JVM 메트릭은 perf 프로필에서만 노출한다

## 원칙

- 알림은 담당자가 행동할 수 있는 조건에만 설정한다.
- 로그에 비밀번호, 토큰, 개인정보와 전체 요청·응답 본문을 남기지 않는다.
- 관찰하려는 질문과 판단 기준을 수집 전에 정한다.
- 사실로 관찰한 값과 팀의 해석을 구분해 기록한다.

## 애플리케이션 메트릭 (Prometheus)

부하 테스트 중 병목이 JVM 메모리·GC, DB 커넥션 풀, 특정 API 중 어디에 있는지 구분하기 위해 Micrometer Prometheus 레지스트리를 사용한다. 의존성은 모든 환경의 실행 JAR에 포함되지만, `/actuator/prometheus` HTTP 노출은 `perf` 프로필에서만 켠다.

별도 Monitoring EC2의 Prometheus·Grafana는 perf-2 EC2의 Node Exporter에서 CPU·메모리·디스크 지표를 수집한다. 애플리케이션 메트릭 원격 수집은 아직 구성하지 않았다.

### 환경별 설정

| 항목                         | dev·prod (`prod`)                                | perf (`prod,perf`)               |
| ---------------------------- | ------------------------------------------------ | -------------------------------- |
| API 포트                     | 80                                               | 80                               |
| Actuator 포트                | 80 (API와 같음)                                  | 9091, `127.0.0.1`에만 바인딩     |
| 노출 엔드포인트              | `health`, `info`                                 | `health`, `info`, `prometheus`   |
| HTTP 응답 시간 히스토그램    | 꺼짐                                             | 켜짐 (`http.server.requests`)    |
| CodeDeploy `ValidateService` | `127.0.0.1:80/actuator/health`, `/actuator/info` | 대상 아님 (perf 파이프라인 없음) |

perf는 `SPRING_PROFILES_ACTIVE=prod,perf`로 실행한다. `prod`의 DB·로그·API 포트 설정을 그대로 쓰고, [`application-perf.yml`](../../src/main/resources/application-perf.yml)의 Actuator 설정만 더한다.

관리 포트를 분리했으므로 perf에서는 `/actuator/health`, `/actuator/info`도 80이 아닌 9091에서 응답한다. 80번의 `/actuator/*`는 404다. dev·prod의 [`validate.sh`](../../deploy/scripts/validate.sh) 검증 경로는 바꾸지 않았다. perf를 CodeDeploy로 배포하게 되면 `HEALTH_URL`, `INFO_URL`을 9091로 지정해야 한다.

### perf 서버에서 확인

9091은 `127.0.0.1`에만 열려 있으므로 perf EC2 안에서 확인한다.

```bash
curl -fsS http://127.0.0.1:9091/actuator/health
curl -fsS http://127.0.0.1:9091/actuator/prometheus | grep -E '^(jvm_memory_used_bytes|hikaricp_connections_active|http_server_requests_seconds_count)'
```

Prometheus 서버가 이 메트릭을 원격으로 수집하려면 인증된 연결 경로를 따로 구성해야 한다. 9091을 공개 ALB나 사설망 전체에 그대로 열지 않는다.

### 주요 메트릭과 PromQL

| 영역     | 질문                     | PromQL                                                                                                                 |
| -------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| CPU      | 서버 CPU 사용률          | `1 - avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[1m]))` (Node Exporter)                                |
| CPU      | JVM 프로세스 CPU 사용률  | `process_cpu_usage`                                                                                                    |
| JVM      | Heap 사용량              | `sum(jvm_memory_used_bytes{area="heap"})`                                                                              |
| JVM      | Non-Heap 사용량          | `sum(jvm_memory_used_bytes{area="nonheap"})`                                                                           |
| JVM      | 초당 GC 정지 시간        | `sum(rate(jvm_gc_pause_seconds_sum[1m]))`                                                                              |
| JVM      | 스레드 수                | `jvm_threads_live_threads`                                                                                             |
| HikariCP | 사용 중·대기 커넥션      | `hikaricp_connections_active`, `hikaricp_connections_idle`, `hikaricp_connections_pending`                             |
| HikariCP | 커넥션 획득 시간 초과    | `increase(hikaricp_connections_timeout_total[5m])`                                                                     |
| HTTP     | API별 초당 요청 수       | `sum by (uri) (rate(http_server_requests_seconds_count[1m]))`                                                          |
| HTTP     | 5xx 비율                 | `sum(rate(http_server_requests_seconds_count{status=~"5.."}[1m])) / sum(rate(http_server_requests_seconds_count[1m]))` |
| HTTP     | API별 p95 응답 시간 (초) | `histogram_quantile(0.95, sum by (le, uri) (rate(http_server_requests_seconds_bucket[1m])))`                           |
| HTTP     | API별 p99 응답 시간 (초) | `histogram_quantile(0.99, sum by (le, uri) (rate(http_server_requests_seconds_bucket[1m])))`                           |

HTTP `uri` 태그는 실제 값이 아닌 경로 템플릿 (`/api/properties/{propertyId}`)으로 기록된다. 인증 필터에서 401로 끝난 요청은 `UNKNOWN`, 매핑되지 않은 경로의 404는 `/**`로 묶인다. 사용자 ID나 매물 ID별로 시계열이 늘어나지 않는다.

`hikaricp_connections_pending`이 0보다 크게 유지되거나 `hikaricp_connections_timeout_total`이 증가하면 커넥션 풀이 부족하다는 신호다. 같은 시각의 RDS 지표와 함께 확인한다.

## 로그 구성

| 실행 환경       | 출력                  | 용도                           |
| --------------- | --------------------- | ------------------------------ |
| `local`, `test` | 사람이 읽는 콘솔 로그 | 개발과 테스트                  |
| `prod` 프로필   | 콘솔 + ECS JSON 파일  | dev·prod EC2와 CloudWatch 수집 |

dev와 prod EC2는 모두 Spring의 `prod` 프로필을 사용한다. `DEPLOYMENT_ENVIRONMENT`를 각각 `dev`, `prod`로 두어 JSON의 `service.environment`를 구분한다.

로그 파일은 다음과 같다.

| 파일                                           | 내용                                | 보존                                            |
| ---------------------------------------------- | ----------------------------------- | ----------------------------------------------- |
| `/var/log/jachwi-sunbae/application.log`       | 애플리케이션·요청·예외 JSON         | 10MB 단위, 최대 14일·1GB                        |
| `/var/log/jachwi-sunbae/service-events.log`    | systemd가 기록한 프로세스 종료 결과 | 종료당 한 줄을 누적하고 CloudWatch에서 7일 보존 |
| `/var/log/jachwi-sunbae/gc.log`                | JVM GC·safepoint 기록               | [JVM 진단 로그](#jvm-진단-로그) 참고            |
| `/var/log/jachwi-diagnostics/thread-dumps.log` | 운영자가 수집한 Thread Dump         | [JVM 진단 로그](#jvm-진단-로그) 참고            |

요청 로그에는 `request_id`, `http_method`, `path`, `status`, `duration_ms`를 기본 필드로 넣는다. 쿼리 문자열, Authorization 헤더, 요청·응답 본문은 기록하지 않는다. 애플리케이션 내부 예외 로그도 같은 `request_id`를 가지므로 요청 완료 로그와 연결할 수 있다.

서버 예외로 실패한 요청 로그에는 `error_type`과 `message`의 `HTTP request failed: <오류 메시지>`를 기록한다. 따라서 5xx 요청 목록에서 오류 메시지를 바로 확인할 수 있다. 자세한 호출 위치와 원인은 같은 `request_id`의 예외 로그에 있는 `error.stack_trace`를 확인한다. 예외 객체 없이 5xx 상태만 반환된 경우에는 원인 메시지가 없으므로 `HTTP request failed`만 남는다. HTTP 응답에는 내부 오류 메시지 대신 공개 오류 메시지를 사용한다.

4xx 요청 로그의 `message`에는 응답의 공개 오류 메시지를 기록한다. 예를 들어 사진 등록 한도 초과는 `등록할 수 있는 사진 개수를 초과했습니다.`, 인증 실패는 `인증 정보를 확인할 수 없습니다.`로 표시된다. 필드별 검증 사유는 HTTP 오류 응답의 `errors`에서 확인한다. 4xx는 `INFO`, 5xx는 `ERROR` 수준으로 남긴다.

`X-Request-Id`는 서버가 매 요청마다 새로 만들고 응답 헤더로 반환한다. 사용자가 전달한 값을 신뢰해 재사용하지 않는다.

## 새 EC2 적용 점검

`/etc/jachwi-sunbae/app.env`에 `DEPLOYMENT_ENVIRONMENT`와 `LOG_PATH`를 환경에 맞게 추가한다.

배포의 `AfterInstall`이 로그 디렉터리와 `jachwi` 사용자의 쓰기 권한을 만든다. 배포 후 다음을 확인한다.

```bash
sudo systemctl status jachwi-sunbae.service
sudo journalctl -u jachwi-sunbae.service -n 200 --no-pager
sudo tail -n 20 /var/log/jachwi-sunbae/application.log
sudo tail -n 20 /var/log/jachwi-sunbae/service-events.log
```

## JVM 진단 로그

애플리케이션 로그만으로 보기 어려운 GC 정지·메모리 부족·스레드 고갈을 확인하기 위해 GC 로그와 Thread Dump를 남긴다. dev·prod가 같은 [systemd 유닛](../../deploy/jachwi-sunbae.service)과 [AfterInstall](../../deploy/scripts/after_install.sh)을 사용하므로 설정과 설치 과정이 같다. 환경별 분기는 없다.

| 대상        | 경로                                           | 소유·권한                           | 보존                                                       |
| ----------- | ---------------------------------------------- | ----------------------------------- | ---------------------------------------------------------- |
| GC 로그     | `/var/log/jachwi-sunbae/gc.log`                | `jachwi`, 디렉터리 `0750`           | JVM이 5MB마다 순환. 현재 파일과 `gc.log.0`~`gc.log.2` 유지 |
| Thread Dump | `/var/log/jachwi-diagnostics/thread-dumps.log` | `root:root` `0600`, 디렉터리 `0700` | logrotate가 2MB 초과 시 순환. 이전 파일 5개 유지           |
| 수집 명령   | `/usr/local/sbin/jachwi-thread-dump`           | `root:root` `0755`                  | 배포마다 저장소 버전으로 교체                              |
| 순환 설정   | `/etc/logrotate.d/jachwi-thread-dumps`         | `root:root` `0644`                  | 배포마다 저장소 버전으로 교체                              |

배포는 `/opt/jachwi-sunbae`만 비운다. GC 로그와 Thread Dump 파일은 배포로 지워지거나 초기화되지 않는다.

### GC 로그

`ExecStart`에 다음 Java 21 Unified Logging 옵션을 둔다. Heap 정책 `-XX:MaxRAMPercentage=50.0`은 그대로다.

```text
-Xlog:gc*,safepoint:file=/var/log/jachwi-sunbae/gc.log:time,uptime,level,tags:filecount=3,filesize=5M
```

- `gc*`는 GC 단계·정지 시간·Heap 변화를, `safepoint`는 모든 Java 스레드를 멈춘 구간을 기록한다.
- 각 줄은 `[2026-10-22T02:31:51.601+0000][0.197s][info][gc          ] GC(0) Pause Young (Normal) (G1 Evacuation Pause) 17M->4M(32M) 2.839ms` 형식이다. 벽시계 시각과 JVM 기동 후 경과 시간을 함께 남긴다.
- JVM이 기동할 때 남아 있는 `gc.log`를 `gc.log.0` 등으로 옮긴 뒤 새로 쓴다. 배포·재시작으로 직전 기록이 덮이지 않는다. 최대 용량은 약 20MB다.
- **JVM은 GC 로그 파일을 열지 못하면 기동하지 않는다.** `AfterInstall`이 로그 디렉터리와 남아 있는 `gc.log*`를 `jachwi` 소유로 맞춘다. 수동으로 디렉터리를 지우거나 root 소유 파일을 만들지 않는다.

### Thread Dump 수집

장애가 진행 중일 때 EC2에서 실행한다.

```bash
sudo /usr/local/sbin/jachwi-thread-dump
```

[jachwi-thread-dump.sh](../../deploy/scripts/jachwi-thread-dump.sh)는 다음 순서로 동작한다.

1. root 권한을 확인하고 잠금을 잡는다. 이미 실행 중이면 바로 실패한다.
2. `jachwi-sunbae.service`가 `active`인지 확인하고 `MainPID`를 조회한다.
3. PID가 `java`이며 `/opt/jachwi-sunbae/app.jar`를 실행하는지, JVM이 SIGQUIT 핸들러를 설치했는지 확인한다. 기동 직후에는 SIGQUIT으로 프로세스가 종료될 수 있어 신호를 보내지 않는다.
4. 현재 journal 위치를 기록한 뒤 `systemctl kill --kill-who=main --signal=SIGQUIT jachwi-sunbae.service`를 보낸다.
5. 현재 부팅의 journal에서 기록한 위치 이후, 해당 PID의 출력만 최대 30초 동안 읽는다. journal 조회는 한 번에 10초로 제한한다.
6. `Full thread dump` 줄부터 스레드 목록의 마지막 줄인 `JNI global refs:`까지를 완전한 덤프로 본다. 이어지는 교착 상태 정보와 Heap 요약을 함께 담고, 그 밖의 애플리케이션 로그는 제외한다.
7. journald가 이 서비스의 출력을 버렸다면(`Suppressed ... messages`) 저장하지 않는다.
8. 아래 구분자로 감싸 `thread-dumps.log`에 덧붙인다. 쓰기에 실패하면 원래 크기로 되돌린다.

```text
===== THREAD DUMP START 2026-10-22T02:00:00Z PID=12345 =====
2026-10-22 11:00:00
Full thread dump OpenJDK 64-Bit Server VM (21.0.12.1+9-LTS mixed mode, sharing):
...
JNI global refs: 9, weak refs: 0

Heap
 ...
===== THREAD DUMP END 2026-10-22T02:00:02Z =====
```

구분자의 시각은 UTC다. 그 안의 첫 줄은 JVM이 출력한 서버 시간대 시각이다. 성공하면 `Thread Dump 를 저장했다`와 PID·줄 수를 출력하고, 실패하면 원인을 출력한 뒤 0이 아닌 값으로 끝난다. 실패한 덤프는 파일에 남지 않는다.

사용 시 주의사항:

- 덤프를 만드는 동안 JVM은 safepoint에서 모든 Java 스레드를 잠시 멈춘다. 정지 시간은 스레드 수에 비례하므로 짧은 간격으로 계속 실행하지 않는다.
- 스레드 상태 변화를 보려면 10초 정도 간격으로 2~3회 실행해 비교한다.
- 덤프 원본은 journal에도 남는다. 스레드 이름·스택만 담고 환경변수나 비밀값은 출력하지 않지만, 파일과 journal 모두 root만 읽도록 유지한다.
- 서비스를 재시작하거나 종료하지 않는다. `MainPID`가 수집 중 바뀌면 저장하지 않고 실패한다.

### logrotate

[jachwi-thread-dumps.logrotate](../../deploy/scripts/jachwi-thread-dumps.logrotate)를 `/etc/logrotate.d/jachwi-thread-dumps`로 설치한다. 별도 타이머 없이 OS 기본 `logrotate.timer`가 하루 한 번 확인한다.

| 설정                    | 의미                                        |
| ----------------------- | ------------------------------------------- |
| `size 2M`               | 2MB를 넘었을 때만 순환한다                  |
| `rotate 5`              | `thread-dumps.log.1`~`.5`를 유지한다        |
| `missingok`             | 아직 덤프가 없어도 오류로 보지 않는다       |
| `notifempty`            | 빈 파일은 순환하지 않는다                   |
| `create 0600 root root` | 이름을 바꾼 뒤 같은 권한의 새 파일을 만든다 |
| `nocompress`            | 압축하지 않는다                             |

`copytruncate`를 쓰지 않는다. 파일 이름을 바꾸고 새 파일을 만드는 방식이라 CloudWatch Agent가 새 파일을 이어서 수집한다. 확인 시 `-d`는 실제로 순환하지 않는다.

```bash
sudo logrotate -d /etc/logrotate.d/jachwi-thread-dumps
sudo systemctl status logrotate.timer
```

### CloudWatch 연동

| 환경 | GC 로그                  | Thread Dump                        | 상태                       |
| ---- | ------------------------ | ---------------------------------- | -------------------------- |
| dev  | `/jachwi-sunbae/dev/gc`  | `/jachwi-sunbae/dev/thread-dumps`  | 수집·순환 후 전송 확인     |
| prod | `/jachwi-sunbae/prod/gc` | `/jachwi-sunbae/prod/thread-dumps` | **미적용.** 별도 작업 필요 |

배포는 CloudWatch Agent 설정을 바꾸지 않는다. 파일 경로와 `===== THREAD DUMP START` 구분자는 Agent 설정과 맞춰야 하므로 바꾸지 않는다. prod에 적용할 때는 dev의 현재 `jachwi-sunbae.json`과 비교해 `collect_list`에 다음 항목을 더하고, 로그 그룹의 `/dev/`를 `/prod/`로 바꾼다.

```json
[
  {
    "file_path": "/var/log/jachwi-sunbae/gc.log",
    "log_group_name": "/jachwi-sunbae/dev/gc",
    "log_stream_name": "{instance_id}-gc",
    "retention_in_days": 7
  },
  {
    "file_path": "/var/log/jachwi-diagnostics/thread-dumps.log",
    "log_group_name": "/jachwi-sunbae/dev/thread-dumps",
    "log_stream_name": "{instance_id}-thread-dumps",
    "multi_line_start_pattern": "^===== THREAD DUMP START",
    "retention_in_days": 7
  }
]
```

Agent는 `root`로 실행하므로 `0700` 진단 디렉터리를 읽을 수 있다. 덤프 하나가 CloudWatch 이벤트 하나가 된다. CloudWatch 이벤트 최대 크기를 넘는 덤프는 잘릴 수 있으므로 전체 내용은 EC2의 파일에서 확인한다.

### 장애 분석

장애 시각을 먼저 정하고 같은 시각의 애플리케이션 로그·`service-events`·EC2 지표와 함께 본다.

| 관찰                                                              | 확인할 기록                                           | 판단                                           |
| ----------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------- |
| 응답 지연, health 지연                                            | `gc.log`의 `Pause` 시간, `safepoint`의 `Total` 시간   | 긴 정지가 지연 시각과 겹치면 GC·safepoint 원인 |
| `Pause Full`, `To-space exhausted`, GC 후에도 Heap이 줄지 않음    | GC 직전·직후 Heap 크기 추이                           | Heap 부족 또는 메모리 누수 의심                |
| `service_result=oom-kill` 또는 `exit_status=KILL`                 | `sudo journalctl -k -b \| grep -i oom`, 직전 `gc.log` | Heap 밖 메모리를 포함한 OS 메모리 부족         |
| 요청 스레드 다수가 `HikariPool.getConnection`에서 `TIMED_WAITING` | Thread Dump, `hikaricp` 관련 경고 로그                | 커넥션 풀 고갈. 커넥션을 쥔 스레드와 RDS 확인  |
| 여러 스레드가 `BLOCKED`, `Found one Java-level deadlock`          | Thread Dump의 `waiting to lock`·`locked` 대상         | 락 경합 또는 교착 상태                         |
| 같은 스택에서 `RUNNABLE`이 2~3회 덤프 내내 유지                   | 연속 Thread Dump, 같은 시각 CPU                       | CPU를 계속 쓰는 코드 경로                      |

GC 로그는 다음과 같이 확인한다.

```bash
sudo tail -n 100 /var/log/jachwi-sunbae/gc.log
sudo grep -h 'Pause' /var/log/jachwi-sunbae/gc.log* | tail -n 50
sudo grep -h 'Pause Full\|To-space exhausted' /var/log/jachwi-sunbae/gc.log*
```

Thread Dump는 다음과 같이 확인한다.

```bash
sudo grep '^===== THREAD DUMP START' /var/log/jachwi-diagnostics/thread-dumps.log | tail -n 5
sudo grep -c 'java.lang.Thread.State: BLOCKED' /var/log/jachwi-diagnostics/thread-dumps.log
sudo less /var/log/jachwi-diagnostics/thread-dumps.log
```

### 배포 후 확인

CodeDeploy 성공 후 EC2에서 확인한다. Thread Dump 명령은 실제 서비스에 SIGQUIT을 보내므로 dev에서 먼저 확인한다.

```bash
# 서비스와 health
sudo systemctl is-active jachwi-sunbae.service
curl -fsS http://127.0.0.1/actuator/health

# JVM 실행 인자에 GC 옵션 반영
PID="$(systemctl show -p MainPID --value jachwi-sunbae.service)"
sudo tr '\0' ' ' < "/proc/${PID}/cmdline"; echo
systemctl cat jachwi-sunbae.service | grep '^ExecStart='

# GC 로그 생성
sudo ls -l /var/log/jachwi-sunbae/gc.log*
sudo tail -n 5 /var/log/jachwi-sunbae/gc.log

# 설치 파일과 권한
sudo stat -c '%A %U:%G %n' /usr/local/sbin/jachwi-thread-dump \
  /etc/logrotate.d/jachwi-thread-dumps /var/log/jachwi-diagnostics

# Thread Dump 수집과 프로세스 유지
sudo /usr/local/sbin/jachwi-thread-dump
sudo stat -c '%A %U:%G %s %n' /var/log/jachwi-diagnostics/thread-dumps.log
sudo grep -c '^===== THREAD DUMP START' /var/log/jachwi-diagnostics/thread-dumps.log
sudo tail -n 20 /var/log/jachwi-diagnostics/thread-dumps.log
test "$(systemctl show -p MainPID --value jachwi-sunbae.service)" = "${PID}" && echo 'PID 유지'
curl -fsS http://127.0.0.1/actuator/health

# logrotate 설정
sudo logrotate -d /etc/logrotate.d/jachwi-thread-dumps

# CloudWatch Agent 수집 (dev)
sudo grep -n 'gc.log\|thread-dumps.log\|THREAD DUMP START' \
  /opt/aws/amazon-cloudwatch-agent/etc/jachwi-sunbae.json
sudo tail -n 50 /opt/aws/amazon-cloudwatch-agent/logs/amazon-cloudwatch-agent.log
```

CloudWatch 콘솔의 `/jachwi-sunbae/dev/thread-dumps`에 방금 실행한 시각의 `===== THREAD DUMP START` 이벤트가 하나로 들어왔는지 확인한다. 순환을 직접 확인하려면 `sudo logrotate -f /etc/logrotate.d/jachwi-thread-dumps`로 강제 순환한 뒤 Thread Dump를 다시 실행해 새 이벤트가 전송되는지 본다. 강제 순환은 이전 파일 하나를 소모한다.

### 수집 실패 시 확인

| 메시지·증상                                          | 확인                                                             | 복구                                                                      |
| ---------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `command not found` 또는 파일 없음                   | `ls -l /usr/local/sbin/jachwi-thread-dump`                       | 최근 배포의 `AfterInstall` 로그 확인 후 재배포                            |
| `다른 Thread Dump 수집이 진행 중이다`                | `pgrep -af jachwi-thread-dump`                                   | 앞선 실행이 끝난 뒤 다시 실행                                             |
| `실행 중이 아니다`, `MainPID 가 올바르지 않다`       | `systemctl status jachwi-sunbae.service`                         | 서비스 장애부터 대응                                                      |
| `SIGQUIT 을 처리할 준비가 되지 않았다`               | 서비스 시작 시각                                                 | 기동이 끝난 뒤 다시 실행                                                  |
| `Thread Dump 를 찾지 못했다`, `출력이 끝나지 않았다` | `sudo journalctl -u jachwi-sunbae.service -b -n 200 --no-pager`  | JVM이 응답하지 않는 상태일 수 있다. journal에 남은 원본을 확인한다        |
| `출력 일부를 버렸다`                                 | `sudo journalctl -t systemd-journald -b \| grep Suppressed`      | journald 출력 제한에 걸렸다. 잠시 뒤 다시 실행                            |
| 배포 후 서비스가 기동하지 않음                       | `journalctl -u jachwi-sunbae.service`의 `Error opening log file` | `/var/log/jachwi-sunbae`와 `gc.log*`의 소유자를 `jachwi`로 맞춘 뒤 재시작 |
| `AfterInstall`이 진단 도구에서 실패                  | `/opt/codedeploy-agent/deployment-root/deployment-logs/`         | 출력된 파일 누락·logrotate 미설치·설정 오류를 고친 뒤 재배포              |

journal 원본은 다음과 같이 확인한다. 저장에 실패해도 SIGQUIT 출력은 journal에 남는다.

```bash
sudo journalctl -u jachwi-sunbae.service -b --since '-5 min' --no-pager | grep -n 'Full thread dump\|JNI global refs'
```

## CloudWatch Logs 구성 및 재구축

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
fields @timestamp, request_id, http_method, path, status, duration_ms, message, error_type
| filter status >= 500
| sort @timestamp desc
| limit 100
```

### 최근 4xx 요청

```text
fields @timestamp, request_id, http_method, path, status, duration_ms, message
| filter status >= 400 and status < 500
| sort @timestamp desc
| limit 100
```

### 요청 ID로 전체 흐름 추적

```text
fields @timestamp, `log.level`, `log.logger`, message, error.message, error.stack_trace, status, duration_ms
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
