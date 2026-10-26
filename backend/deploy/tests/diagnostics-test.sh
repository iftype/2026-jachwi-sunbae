#!/usr/bin/env bash
# JVM 진단 도구(Thread Dump 스크립트·logrotate·AfterInstall 설치·systemd 유닛)를 검증한다.
# /opt, /etc, /usr/local/sbin 에 파일을 만들므로 버려도 되는 Amazon Linux 2023 컨테이너에서만 실행한다.
#
#   docker run --rm -v "$PWD/backend/deploy:/deploy:ro" -e JACHWI_DIAGNOSTICS_TEST=container \
#     amazonlinux:2023 bash -c 'dnf install -y -q java-21-amazon-corretto-headless logrotate \
#     systemd util-linux procps-ng shadow-utils findutils >/dev/null && bash /deploy/tests/diagnostics-test.sh'
set -uo pipefail

if [[ "${JACHWI_DIAGNOSTICS_TEST:-}" != container || "$(id -u)" != 0 ]]; then
    echo "버려도 되는 컨테이너에서 root 로 JACHWI_DIAGNOSTICS_TEST=container 를 지정해 실행한다." >&2
    exit 1
fi

DEPLOY_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="${DEPLOY_DIR}/scripts/jachwi-thread-dump.sh"
T="$(mktemp -d)"
trap 'jobs -p | xargs -r kill 2>/dev/null; rm -rf "${T}"' EXIT

PASSED=0
FAILED=0
pass() { PASSED=$((PASSED + 1)); echo "PASS: $1"; }
fail() { FAILED=$((FAILED + 1)); echo "FAIL: $1" >&2; }
check() { local name="$1"; shift; if "$@"; then pass "${name}"; else fail "${name}"; fi; }

# --- 모의 systemctl·journalctl ---------------------------------------------------------
# journal 은 파일 하나로 흉내 낸다. 커서는 파일 크기이고 --after-cursor 는 그 뒤의 내용만 돌려준다.
mkdir -p "${T}/bin"
cat > "${T}/bin/systemctl" <<'EOF'
#!/usr/bin/env bash
echo "$*" >> "${MOCK_DIR}/systemctl.calls"
case "$1" in
    show)
        case "$3" in
            ActiveState) cat "${MOCK_DIR}/active" ;;
            MainPID)
                n=$(( $(cat "${MOCK_DIR}/mainpid.count" 2>/dev/null || echo 0) + 1 ))
                echo "${n}" > "${MOCK_DIR}/mainpid.count"
                if (( n >= 2 )) && [[ -f "${MOCK_DIR}/mainpid.after" ]]; then
                    cat "${MOCK_DIR}/mainpid.after"
                else
                    cat "${MOCK_DIR}/mainpid"
                fi
                ;;
        esac
        ;;
    kill)
        if [[ -f "${MOCK_DIR}/real_pid" ]]; then
            kill -QUIT "$(cat "${MOCK_DIR}/real_pid")"
        elif [[ -f "${MOCK_DIR}/response" ]]; then
            cat "${MOCK_DIR}/response" >> "${MOCK_DIR}/journal"
        fi
        ;;
esac
EOF
cat > "${T}/bin/journalctl" <<'EOF'
#!/usr/bin/env bash
echo "$*" >> "${MOCK_DIR}/journalctl.calls"
if [[ "$*" == *"--output-fields=__CURSOR"* ]]; then
    echo "__CURSOR=$(stat -c %s "${MOCK_DIR}/journal")"
    exit 0
fi
if [[ "$*" == *"-t systemd-journald"* ]]; then
    cat "${MOCK_DIR}/journald" 2>/dev/null
    exit 0
fi
if [[ -f "${MOCK_DIR}/journal_hang" ]]; then
    sleep 30
fi
cursor="$(sed -n 's/.*--after-cursor=\([0-9]*\).*/\1/p' <<< "$*")"
tail -c +"$((cursor + 1))" "${MOCK_DIR}/journal"
EOF
chmod 0755 "${T}/bin/"*

# HotSpot 21 의 SIGQUIT 출력 형식을 따른 덤프. 실제 JVM 출력은 아래 실제 JVM 테스트에서 따로 확인한다.
DUMP_FIXTURE='2026-10-22 11:00:00
Full thread dump OpenJDK 64-Bit Server VM (21.0.12.1+9-LTS mixed mode, sharing):

Threads class SMR info:
_java_thread_list=0x0000ffff2c1797a0, length=1, elements={
0x0000ffff8401a750
}

"main" #1 [13] prio=5 os_prio=0 cpu=187.34ms elapsed=0.19s tid=0x0000ffff8401a750 nid=13 waiting on condition
   java.lang.Thread.State: TIMED_WAITING (sleeping)
	at java.lang.Thread.sleep0(java.base@21.0.12.1/Native Method)

"VM Thread" os_prio=0 cpu=1.00ms elapsed=0.19s tid=0x0000ffff8410fe00 nid=14 runnable

JNI global refs: 9, weak refs: 0

Heap
 garbage-first heap   total 129024K, used 18356K [0x0000000708000000, 0x0000000800000000)
 Metaspace       used 9482K, committed 9728K, reserved 1114112K
'

# 테스트마다 새 모의 환경을 만든다. OUT 은 Thread Dump 저장 파일이다.
setup() {
    export MOCK_DIR="${T}/case-$1"
    rm -rf "${MOCK_DIR}"
    mkdir -p "${MOCK_DIR}/proc/4242" "${MOCK_DIR}/jdk/bin" "${MOCK_DIR}/tmp"
    touch "${MOCK_DIR}/jdk/bin/java"
    ln -s "${MOCK_DIR}/jdk/bin/java" "${MOCK_DIR}/proc/4242/exe"
    printf '/usr/bin/java\0-XX:MaxRAMPercentage=50.0\0-jar\0/opt/jachwi-sunbae/app.jar\0' > "${MOCK_DIR}/proc/4242/cmdline"
    printf 'Name:\tjava\nSigCgt:\t2000000101005ccd\n' > "${MOCK_DIR}/proc/4242/status"
    echo active > "${MOCK_DIR}/active"
    echo 4242 > "${MOCK_DIR}/mainpid"
    printf '이전 부팅이 아닌 지난 실행의 덤프\nFull thread dump OLD\nJNI global refs: 1, weak refs: 0\n' > "${MOCK_DIR}/journal"
    printf '%s' "${DUMP_FIXTURE}" > "${MOCK_DIR}/response"
    printf '2026-10-22T11:00:01.000Z INFO 4242 --- [main] c.j.App : 일반 애플리케이션 로그\n' >> "${MOCK_DIR}/response"
    OUT="${MOCK_DIR}/diag/thread-dumps.log"
}

run_dump() {
    env PATH="${T}/bin:${PATH}" TMPDIR="${MOCK_DIR}/tmp" PROC_DIR="${MOCK_DIR}/proc" DIAG_DIR="${MOCK_DIR}/diag" \
        LOCK_FILE="${MOCK_DIR}/lock" WAIT_SECONDS="${WAIT_SECONDS:-3}" JOURNAL_TIMEOUT="${JOURNAL_TIMEOUT:-5s}" \
        bash "${SCRIPT}" > "${MOCK_DIR}/stdout" 2> "${MOCK_DIR}/stderr"
}

kill_not_sent() { ! grep -q '^kill' "${MOCK_DIR}/systemctl.calls" 2>/dev/null; }
stderr_has() { grep -Fq "$1" "${MOCK_DIR}/stderr"; }
tmp_cleaned() { [[ -z "$(ls -A "${MOCK_DIR}/tmp")" ]]; }
out_absent_or_unchanged() { [[ ! -e "${OUT}" ]] || [[ "$(cat "${OUT}")" == "$1" ]]; }

# --- Thread Dump 스크립트 ----------------------------------------------------------------
check "bash -n jachwi-thread-dump.sh" bash -n "${SCRIPT}"
for script in "${DEPLOY_DIR}"/scripts/*.sh; do
    check "bash -n ${script##*/}" bash -n "${script}"
done

setup success
run_dump
check "정상 수집: 종료 코드 0" [ $? -eq 0 ]
check "정상 수집: 검증된 SIGQUIT 명령 사용" grep -Fxq 'kill --kill-who=main --signal=SIGQUIT jachwi-sunbae.service' "${MOCK_DIR}/systemctl.calls"
check "정상 수집: 현재 부팅·커서 이후·대상 PID 만 조회" grep -Eq -- '^-b --after-cursor=[0-9]+ _SYSTEMD_UNIT=jachwi-sunbae.service _PID=4242 ' "${MOCK_DIR}/journalctl.calls"
check "정상 수집: 시작 구분자" grep -Eq '^===== THREAD DUMP START [0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]{8}Z PID=4242 =====$' "${OUT}"
check "정상 수집: 종료 구분자" grep -Eq '^===== THREAD DUMP END [0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]{8}Z =====$' "${OUT}"
check "정상 수집: 덤프 시각 줄 포함" grep -Fxq '2026-10-22 11:00:00' "${OUT}"
check "정상 수집: Heap 요약 포함" grep -Fq 'Metaspace       used' "${OUT}"
check "정상 수집: 과거 덤프 제외" bash -c '! grep -Fq "Full thread dump OLD" "$1"' _ "${OUT}"
check "정상 수집: 일반 애플리케이션 로그 제외" bash -c '! grep -Fq "일반 애플리케이션 로그" "$1"' _ "${OUT}"
check "정상 수집: 디렉터리 0700 root" [ "$(stat -c '%a %U %G' "${MOCK_DIR}/diag")" == "700 root root" ]
check "정상 수집: 파일 0600 root" [ "$(stat -c '%a %U %G' "${OUT}")" == "600 root root" ]
check "정상 수집: 완료 메시지" grep -Fq 'Thread Dump 를 저장했다' "${MOCK_DIR}/stdout"
check "정상 수집: 비밀 정보 출력 없음" bash -c '! grep -Eqi "password|secret|token" "$1" "$2"' _ "${MOCK_DIR}/stdout" "${MOCK_DIR}/stderr"
check "정상 수집: 임시 파일 정리" tmp_cleaned

FIRST="$(cat "${OUT}")"
rm -f "${MOCK_DIR}/mainpid.count"
run_dump
check "반복 실행: 성공" [ $? -eq 0 ]
check "반복 실행: 기존 덤프 보존 후 추가" [ "$(head -c "${#FIRST}" "${OUT}")" == "${FIRST}" ]
check "반복 실행: 덤프 2개" [ "$(grep -c '^===== THREAD DUMP START' "${OUT}")" -eq 2 ]
check "반복 실행: 이번 덤프만 추가" [ "$(grep -c '^Full thread dump' "${OUT}")" -eq 2 ]

setup nonroot
chmod -R a+rX "${T}"
setpriv --reuid=65534 --regid=65534 --clear-groups env PATH="${T}/bin:${PATH}" MOCK_DIR="${MOCK_DIR}" \
    PROC_DIR="${MOCK_DIR}/proc" DIAG_DIR="${MOCK_DIR}/diag" LOCK_FILE="${T}/nonroot.lock" \
    bash "${SCRIPT}" > /dev/null 2> "${MOCK_DIR}/stderr"
check "root 아님: 실패" [ $? -ne 0 ]
check "root 아님: 안내 메시지" stderr_has 'root 권한으로 실행해야 한다'
check "root 아님: 신호 미전송" kill_not_sent

setup inactive
echo inactive > "${MOCK_DIR}/active"
run_dump
check "서비스 미실행: 실패" [ $? -ne 0 ]
check "서비스 미실행: 메시지" stderr_has '실행 중이 아니다'
check "서비스 미실행: 신호 미전송" kill_not_sent

setup nopid
echo 0 > "${MOCK_DIR}/mainpid"
run_dump
check "MainPID 0: 실패" [ $? -ne 0 ]
check "MainPID 0: 메시지" stderr_has 'MainPID 가 올바르지 않다'
check "MainPID 0: 신호 미전송" kill_not_sent

setup notjava
ln -sfn /usr/bin/python3 "${MOCK_DIR}/proc/4242/exe"
run_dump
check "java 아님: 실패" [ $? -ne 0 ]
check "java 아님: 메시지" stderr_has 'java 프로세스가 아니다'
check "java 아님: 신호 미전송" kill_not_sent

setup otherjar
printf '/usr/bin/java\0-jar\0/opt/other/app.jar\0' > "${MOCK_DIR}/proc/4242/cmdline"
run_dump
check "다른 JAR: 실패" [ $? -ne 0 ]
check "다른 JAR: 신호 미전송" kill_not_sent

setup vanished
rm -rf "${MOCK_DIR}/proc/4242"
run_dump
check "PID 사라짐: 실패" [ $? -ne 0 ]
check "PID 사라짐: 신호 미전송" kill_not_sent

setup nohandler
printf 'Name:\tjava\nSigCgt:\t0000000000000000\n' > "${MOCK_DIR}/proc/4242/status"
run_dump
check "SIGQUIT 핸들러 없음: 실패" [ $? -ne 0 ]
check "SIGQUIT 핸들러 없음: 메시지" stderr_has 'SIGQUIT 을 처리할 준비가 되지 않았다'
check "SIGQUIT 핸들러 없음: 신호 미전송" kill_not_sent

setup nodump
rm "${MOCK_DIR}/response"
WAIT_SECONDS=2 run_dump
check "덤프 없음: 실패" [ $? -ne 0 ]
check "덤프 없음: 과거 덤프로 대체하지 않음" stderr_has 'Thread Dump 를 찾지 못했다'
check "덤프 없음: 저장 안 함" out_absent_or_unchanged ''
check "덤프 없음: 임시 파일 정리" tmp_cleaned

setup incomplete
printf '2026-10-22 11:00:00\nFull thread dump OpenJDK\n\n"main" #1 prio=5\n' > "${MOCK_DIR}/response"
mkdir -p "${MOCK_DIR}/diag" && printf 'EXISTING\n' > "${OUT}"
WAIT_SECONDS=2 run_dump
check "불완전 덤프: 실패" [ $? -ne 0 ]
check "불완전 덤프: 메시지" stderr_has '출력이 끝나지 않았다'
check "불완전 덤프: 기존 파일 그대로" out_absent_or_unchanged 'EXISTING'
check "불완전 덤프: 임시 파일 정리" tmp_cleaned

setup suppressed
echo 'Suppressed 3021 messages from jachwi-sunbae.service' > "${MOCK_DIR}/journald"
run_dump
check "journald 누락: 실패" [ $? -ne 0 ]
check "journald 누락: 메시지" stderr_has '출력 일부를 버렸다'
check "journald 누락: 저장 안 함" out_absent_or_unchanged ''

setup hang
touch "${MOCK_DIR}/journal_hang"
START=${SECONDS}
JOURNAL_TIMEOUT=1s run_dump
check "journal 응답 없음: 실패" [ $? -ne 0 ]
check "journal 응답 없음: 제한 시간 메시지" stderr_has '제한 시간'
check "journal 응답 없음: 제한 시간 안에 종료" [ $((SECONDS - START)) -lt 10 ]

setup pidchanged
echo 5555 > "${MOCK_DIR}/mainpid.after"
run_dump
check "PID 변경: 실패" [ $? -ne 0 ]
check "PID 변경: 저장 안 함" out_absent_or_unchanged ''

setup locked
flock "${MOCK_DIR}/lock" sleep 5 &
sleep 0.5
run_dump
check "중복 실행: 실패" [ $? -ne 0 ]
check "중복 실행: 메시지" stderr_has '진행 중이다'
check "중복 실행: 신호 미전송" kill_not_sent
wait

setup symlink
mkdir -p "${MOCK_DIR}/diag"
ln -s /etc/passwd "${OUT}"
run_dump
check "저장 파일 심볼릭 링크: 실패" [ $? -ne 0 ]
check "저장 파일 심볼릭 링크: 대상 파일 변경 없음" bash -c '! grep -q "THREAD DUMP" /etc/passwd'

# --- 실제 JVM ----------------------------------------------------------------------------
# 실제 HotSpot 21 프로세스에 SIGQUIT 을 보내 출력 형식과 프로세스 유지를 확인한다.
setup realjvm
mkdir -p "${MOCK_DIR}/app"
cat > "${MOCK_DIR}/app/Idle.java" <<'EOF'
public class Idle {
    public static void main(String[] args) throws Exception {
        System.out.println("app started");
        while (true) {
            System.out.println("2026-10-22T11:00:00.000Z INFO tick");
            Thread.sleep(700);
        }
    }
}
EOF
: > "${MOCK_DIR}/journal"
java -XX:MaxRAMPercentage=50.0 \
    -Xlog:gc*,safepoint:file="${MOCK_DIR}/app/gc.log":time,uptime,level,tags:filecount=3,filesize=5M \
    "${MOCK_DIR}/app/Idle.java" >> "${MOCK_DIR}/journal" 2>&1 &
JAVA_PID=$!
for _ in $(seq 100); do grep -q 'app started' "${MOCK_DIR}/journal" && break; sleep 0.2; done
echo "${JAVA_PID}" > "${MOCK_DIR}/mainpid"
echo "${JAVA_PID}" > "${MOCK_DIR}/real_pid"
env PATH="${T}/bin:${PATH}" APP_JAR="${MOCK_DIR}/app/Idle.java" DIAG_DIR="${MOCK_DIR}/diag" \
    LOCK_FILE="${MOCK_DIR}/lock" WAIT_SECONDS=15 \
    bash "${SCRIPT}" > "${MOCK_DIR}/stdout" 2> "${MOCK_DIR}/stderr"
check "실제 JVM: 수집 성공" [ $? -eq 0 ]
check "실제 JVM: Full thread dump" grep -q '^Full thread dump OpenJDK' "${OUT}"
check "실제 JVM: 스레드 목록 끝까지 수집" grep -q '^JNI global refs: ' "${OUT}"
check "실제 JVM: main 스레드" grep -q '^"main" ' "${OUT}"
check "실제 JVM: 애플리케이션 출력 제외" bash -c '! grep -q "tick\|app started" "$1"' _ "${OUT}"
check "실제 JVM: 프로세스 유지" kill -0 "${JAVA_PID}"
check "실제 JVM: GC 로그 생성" grep -q '\[info\]\[gc' "${MOCK_DIR}/app/gc.log"
check "실제 JVM: safepoint 로그 생성" grep -q '\[safepoint' "${MOCK_DIR}/app/gc.log"
rm -f "${MOCK_DIR}/mainpid.count"
env PATH="${T}/bin:${PATH}" APP_JAR="${MOCK_DIR}/app/Idle.java" DIAG_DIR="${MOCK_DIR}/diag" \
    LOCK_FILE="${MOCK_DIR}/lock" WAIT_SECONDS=15 bash "${SCRIPT}" > /dev/null 2>&1
check "실제 JVM: 반복 수집" [ "$(grep -c '^===== THREAD DUMP END' "${OUT}")" -eq 2 ]
check "실제 JVM: 반복 후 프로세스 유지" kill -0 "${JAVA_PID}"
kill "${JAVA_PID}"

# --- logrotate ---------------------------------------------------------------------------
LOGROTATE_CONF="${DEPLOY_DIR}/scripts/jachwi-thread-dumps.logrotate"
install -o root -g root -m 0644 "${LOGROTATE_CONF}" "${T}/logrotate.conf"
check "logrotate: 설정 검증" bash -c 'logrotate --debug "$1" > /dev/null 2>&1' _ "${T}/logrotate.conf"
check "logrotate: copytruncate 미사용" bash -c '! grep -q copytruncate "$1"' _ "${LOGROTATE_CONF}"
install -d -o root -g root -m 0700 /var/log/jachwi-diagnostics
head -c $((3 * 1024 * 1024)) /dev/zero | tr '\0' 'a' > /var/log/jachwi-diagnostics/thread-dumps.log
chmod 0600 /var/log/jachwi-diagnostics/thread-dumps.log
logrotate -s "${T}/logrotate.status" "${T}/logrotate.conf"
check "logrotate: 2M 초과 시 순환" [ -s /var/log/jachwi-diagnostics/thread-dumps.log.1 ]
check "logrotate: 새 파일 0600 root" [ "$(stat -c '%a %U %G %s' /var/log/jachwi-diagnostics/thread-dumps.log)" == "600 root root 0" ]
check "logrotate: 압축 안 함" bash -c '! ls /var/log/jachwi-diagnostics | grep -q gz'
logrotate -s "${T}/logrotate.status" "${T}/logrotate.conf"
check "logrotate: 빈 파일은 순환 안 함" [ ! -e /var/log/jachwi-diagnostics/thread-dumps.log.2 ]
for i in $(seq 7); do
    echo "dump ${i}" > /var/log/jachwi-diagnostics/thread-dumps.log
    logrotate -f -s "${T}/logrotate.status" "${T}/logrotate.conf"
done
check "logrotate: 이전 파일 최대 5개" [ "$(ls /var/log/jachwi-diagnostics | grep -c '^thread-dumps.log\.')" -eq 5 ]
rm -rf /var/log/jachwi-diagnostics
logrotate -s "${T}/logrotate.status" "${T}/logrotate.conf" 2> "${T}/missing.err"
check "logrotate: 파일 없어도 성공 (missingok)" [ $? -eq 0 ]

# --- AfterInstall 설치와 재배포 ------------------------------------------------------------
# Vault 스크립트와 systemctl 은 모의로 바꾸고 나머지 AfterInstall 은 그대로 실행한다.
deploy_bundle() {
    rm -rf /opt/jachwi-sunbae
    mkdir -p /opt/jachwi-sunbae
    cp -R "${DEPLOY_DIR}/scripts" "${DEPLOY_DIR}/jachwi-sunbae.service" "${DEPLOY_DIR}/appspec.yml" /opt/jachwi-sunbae/
    echo jar > /opt/jachwi-sunbae/app.jar
    printf '#!/usr/bin/env bash\necho prepare_vault 모의\n' > /opt/jachwi-sunbae/scripts/prepare_vault.sh
    printf '#!/usr/bin/env bash\nmkdir -p /etc/jachwi-sunbae\necho X=1 > /etc/jachwi-sunbae/app.env\n' > /opt/jachwi-sunbae/scripts/fetch_env.sh
}
mkdir -p "${T}/deploy-bin"
printf '#!/usr/bin/env bash\necho "$*" >> %s/deploy-systemctl.calls\n' "${T}" > "${T}/deploy-bin/systemctl"
chmod 0755 "${T}/deploy-bin/systemctl"
id jachwi &>/dev/null || useradd --system --no-create-home jachwi
install -d -o root -g root -m 0755 /var/log/jachwi-diagnostics
printf 'PREVIOUS DUMP\n' > /var/log/jachwi-diagnostics/thread-dumps.log
chmod 0644 /var/log/jachwi-diagnostics/thread-dumps.log
printf 'ROTATED DUMP\n' > /var/log/jachwi-diagnostics/thread-dumps.log.1
install -d -m 0755 /var/log/jachwi-sunbae
printf 'OLD GC\n' > /var/log/jachwi-sunbae/gc.log

for round in 1 2; do
    deploy_bundle
    if [[ "${round}" == 1 ]]; then DEPLOY_GROUP=jachwi-sunbae-dev-group; else DEPLOY_GROUP=jachwi-sunbae-codeDeploy-group; fi
    PATH="${T}/deploy-bin:${PATH}" DEPLOYMENT_GROUP_NAME="${DEPLOY_GROUP}" \
        bash /opt/jachwi-sunbae/scripts/after_install.sh > "${T}/after_install.out" 2>&1
    check "AfterInstall ${round}회차: 성공" [ $? -eq 0 ]
done
check "AfterInstall: 실행 파일 root 0755" [ "$(stat -c '%a %U %G' /usr/local/sbin/jachwi-thread-dump)" == "755 root root" ]
check "AfterInstall: 저장소 스크립트와 동일" cmp -s "${SCRIPT}" /usr/local/sbin/jachwi-thread-dump
check "AfterInstall: sudo 경로에서 실행 가능" bash -c 'PATH=/usr/local/sbin:/usr/bin command -v jachwi-thread-dump > /dev/null'
check "AfterInstall: logrotate 설정 root 0644" [ "$(stat -c '%a %U %G' /etc/logrotate.d/jachwi-thread-dumps)" == "644 root root" ]
check "AfterInstall: 진단 디렉터리 root 0700" [ "$(stat -c '%a %U %G' /var/log/jachwi-diagnostics)" == "700 root root" ]
check "AfterInstall: 기존 덤프 보존" [ "$(cat /var/log/jachwi-diagnostics/thread-dumps.log)" == "PREVIOUS DUMP" ]
check "AfterInstall: 순환된 덤프 보존" [ "$(cat /var/log/jachwi-diagnostics/thread-dumps.log.1)" == "ROTATED DUMP" ]
check "AfterInstall: 기존 GC 로그 보존" grep -Fxq 'OLD GC' /var/log/jachwi-sunbae/gc.log
check "AfterInstall: 기존 GC 로그 jachwi 쓰기" setpriv --reuid=jachwi --regid=jachwi --clear-groups bash -c '>> /var/log/jachwi-sunbae/gc.log'
check "AfterInstall: GC 로그 디렉터리 jachwi 쓰기" setpriv --reuid=jachwi --regid=jachwi --clear-groups touch /var/log/jachwi-sunbae/gc.log.0
check "AfterInstall: systemd 유닛 설치" grep -Fq -- '-Xlog:gc*,safepoint:file=/var/log/jachwi-sunbae/gc.log:time,uptime,level,tags:filecount=3,filesize=5M' /etc/systemd/system/jachwi-sunbae.service
check "AfterInstall: 유닛 설치 순서 유지" grep -q 'daemon-reload' "${T}/deploy-systemctl.calls"

deploy_bundle
rm /opt/jachwi-sunbae/scripts/jachwi-thread-dumps.logrotate
PATH="${T}/deploy-bin:${PATH}" DEPLOYMENT_GROUP_NAME=jachwi-sunbae-dev-group \
    bash /opt/jachwi-sunbae/scripts/after_install.sh > "${T}/after_install.out" 2>&1
check "AfterInstall: 산출물 누락 시 실패" [ $? -ne 0 ]
check "AfterInstall: 누락 파일 안내" grep -Fq '배포 산출물에 진단 도구 파일이 없다' "${T}/after_install.out"

# --- systemd 유닛 -------------------------------------------------------------------------
deploy_bundle
mkdir -p /etc/jachwi-sunbae && touch /etc/jachwi-sunbae/app.env
[[ -e /usr/bin/java ]] || ln -s "$(readlink -f "$(command -v java)")" /usr/bin/java
systemd-analyze verify "${DEPLOY_DIR}/jachwi-sunbae.service" > "${T}/verify.out" 2>&1
check "systemd 유닛 문법 검증" [ $? -eq 0 ]
check "systemd 유닛: 고정 Firebase 인증 경로" grep -Fxq 'Environment="GOOGLE_APPLICATION_CREDENTIALS=/etc/jachwi-sunbae/firebase/service-account.json"' "${DEPLOY_DIR}/jachwi-sunbae.service"
cat "${T}/verify.out"
EXEC_START="$(sed -n 's/^ExecStart=//p' "${DEPLOY_DIR}/jachwi-sunbae.service")"
check "systemd 유닛: 기존 Heap 정책 유지" grep -Fq -- '-XX:MaxRAMPercentage=50.0' <<< "${EXEC_START}"
check "systemd 유닛: JVM 이 GC 옵션 허용" java $(sed 's/-jar .*//; s/^[^ ]* //; s#/var/log/jachwi-sunbae/gc.log#'"${T}"'/gc.log#' <<< "${EXEC_START}") -version

echo
echo "결과: ${PASSED} 통과, ${FAILED} 실패"
(( FAILED == 0 ))
