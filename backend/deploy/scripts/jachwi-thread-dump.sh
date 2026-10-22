#!/usr/bin/env bash
set -euo pipefail
umask 077

# 실행 중인 Spring Boot JVM에 SIGQUIT을 보내 Thread Dump를 남기고, 이번 실행으로 생긴
# 덤프만 journal에서 꺼내 thread-dumps.log 에 덧붙인다. JVM은 SIGQUIT을 받아도 종료하지 않는다.
# CodeDeploy AfterInstall 이 /usr/local/sbin/jachwi-thread-dump 로 설치한다.

SERVICE="${SERVICE:-jachwi-sunbae.service}"
APP_JAR="${APP_JAR:-/opt/jachwi-sunbae/app.jar}"
DIAG_DIR="${DIAG_DIR:-/var/log/jachwi-diagnostics}"
OUTPUT_FILE="${OUTPUT_FILE:-${DIAG_DIR}/thread-dumps.log}"
LOCK_FILE="${LOCK_FILE:-/run/jachwi-thread-dump.lock}"
WAIT_SECONDS="${WAIT_SECONDS:-30}"
JOURNAL_TIMEOUT="${JOURNAL_TIMEOUT:-10s}"
SYSTEMCTL="${SYSTEMCTL:-systemctl}"
JOURNALCTL="${JOURNALCTL:-journalctl}"
PROC_DIR="${PROC_DIR:-/proc}"

fail() {
    echo "Thread Dump 수집 실패: $*" >&2
    exit 1
}

if [[ "$(id -u)" != 0 ]]; then
    fail "root 권한으로 실행해야 한다. sudo jachwi-thread-dump"
fi

# 동시에 두 번 실행하면 journal 에서 서로의 덤프를 가져갈 수 있어 한 번에 하나만 허용한다.
exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
    fail "다른 Thread Dump 수집이 진행 중이다. 끝난 뒤 다시 실행한다."
fi

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "${WORK_DIR}"' EXIT

if [[ "$("${SYSTEMCTL}" show -p ActiveState --value "${SERVICE}")" != active ]]; then
    fail "${SERVICE} 가 실행 중이 아니다."
fi

PID="$("${SYSTEMCTL}" show -p MainPID --value "${SERVICE}")"
if [[ ! "${PID}" =~ ^[1-9][0-9]*$ ]]; then
    fail "${SERVICE} 의 MainPID 가 올바르지 않다: ${PID:-없음}"
fi

# 다른 프로세스에 신호를 보내지 않도록 대상이 이 애플리케이션의 JVM 인지 확인한다.
EXE="$(readlink "${PROC_DIR}/${PID}/exe" 2>/dev/null || true)"
if [[ "${EXE##*/}" != java ]]; then
    fail "PID ${PID} 가 java 프로세스가 아니다."
fi
if ! tr '\0' '\n' < "${PROC_DIR}/${PID}/cmdline" 2>/dev/null | grep -Fxq "${APP_JAR}"; then
    fail "PID ${PID} 가 ${APP_JAR} 를 실행하는 프로세스가 아니다."
fi

# JVM 이 SIGQUIT 핸들러를 설치하기 전(기동 직후)에 신호를 받으면 기본 동작대로 종료된다.
# SigCgt 의 SIGQUIT(3번) 비트로 핸들러 설치 여부를 확인한다.
SIGCGT="$(awk '/^SigCgt:/ { print $2 }' "${PROC_DIR}/${PID}/status" 2>/dev/null || true)"
if [[ ! "${SIGCGT}" =~ ^[0-9a-fA-F]+$ ]] || (( (16#${SIGCGT} & 4) == 0 )); then
    fail "PID ${PID} 가 SIGQUIT 을 처리할 준비가 되지 않았다. 종료될 수 있어 신호를 보내지 않는다."
fi

# 신호를 보내기 전 journal 위치를 기록해 두고, 그 뒤의 출력만 읽는다. 과거 덤프를 다시 저장하지 않는다.
CURSOR="$(timeout "${JOURNAL_TIMEOUT}" "${JOURNALCTL}" -b -n 1 -o export --output-fields=__CURSOR \
    | sed -n 's/^__CURSOR=//p' | tail -n 1)" || fail "journal 위치를 조회하지 못했다."
if [[ -z "${CURSOR}" ]]; then
    fail "journal 위치를 조회하지 못했다."
fi

STARTED_AT="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
"${SYSTEMCTL}" kill --kill-who=main --signal=SIGQUIT "${SERVICE}" \
    || fail "${SERVICE} 에 SIGQUIT 을 보내지 못했다."

if [[ "$("${SYSTEMCTL}" show -p MainPID --value "${SERVICE}")" != "${PID}" ]]; then
    fail "신호를 보내는 동안 ${SERVICE} 의 MainPID 가 바뀌었다."
fi

read_journal() {
    timeout "${JOURNAL_TIMEOUT}" "${JOURNALCTL}" -b --after-cursor="${CURSOR}" \
        "_SYSTEMD_UNIT=${SERVICE}" "_PID=${PID}" -o cat --no-pager -q > "${WORK_DIR}/journal" \
        || fail "journal 을 제한 시간 ${JOURNAL_TIMEOUT} 안에 읽지 못했다."
}

# HotSpot 의 SIGQUIT 출력은 시각 줄, "Full thread dump ..." 로 시작하는 스레드 목록,
# "JNI global refs: ..." 줄 순서로 끝난다. 그 뒤에 교착 상태 정보와 Heap 요약이 이어질 수 있다.
# 마지막 줄이 나온 덤프만 완전한 것으로 보고, 덤프 밖의 애플리케이션 로그는 제외한다.
extract_dump() {
    awk '
        state == 0 {
            if ($0 ~ /^Full thread dump /) {
                if (prev ~ /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]$/) {
                    print prev
                }
                print
                state = 1
            }
            prev = $0
            next
        }
        state == 1 {
            print
            if ($0 ~ /^JNI global refs: /) {
                state = 2
            }
            next
        }
        state == 2 {
            if ($0 == "") {
                blank++
                next
            }
            if ($0 == "Heap" || $0 ~ /^[ \t]/ || $0 ~ /^"/ || $0 ~ /^=+$/ \
                || $0 ~ /^Found (one Java-level deadlock:|[0-9]+ deadlocks?\.)/ \
                || $0 ~ /^Java stack information for the threads listed above:/) {
                for (; blank > 0; blank--) print ""
                print
                next
            }
            exit
        }
        END { exit (state == 2 ? 0 : 1) }
    ' "${WORK_DIR}/journal" > "${WORK_DIR}/dump"
}

DEADLINE=$((SECONDS + WAIT_SECONDS))
until read_journal && extract_dump; do
    if (( SECONDS >= DEADLINE )); then
        if grep -q '^Full thread dump ' "${WORK_DIR}/journal"; then
            fail "${WAIT_SECONDS}초 안에 Thread Dump 출력이 끝나지 않았다. 불완전한 덤프는 저장하지 않는다."
        fi
        fail "${WAIT_SECONDS}초 안에 journal 에서 Thread Dump 를 찾지 못했다."
    fi
    sleep 1
done

# 마지막 줄 뒤에 이어지는 Heap 요약까지 담기 위해 한 번 더 읽는다.
sleep 1
read_journal
extract_dump || fail "Thread Dump 를 다시 읽지 못했다."

# journald 의 출력 제한에 걸리면 덤프 중간이 빠진다. 빠진 덤프는 저장하지 않는다.
JOURNALD_MESSAGES="$(timeout "${JOURNAL_TIMEOUT}" "${JOURNALCTL}" -b --after-cursor="${CURSOR}" \
    -t systemd-journald -o cat --no-pager -q)" || fail "journald 상태를 확인하지 못했다."
if grep -F "Suppressed" <<< "${JOURNALD_MESSAGES}" | grep -Fq "${SERVICE}"; then
    fail "journald 가 ${SERVICE} 출력 일부를 버렸다. 불완전한 덤프는 저장하지 않는다."
fi

{
    printf '===== THREAD DUMP START %s PID=%s =====\n' "${STARTED_AT}" "${PID}"
    cat "${WORK_DIR}/dump"
    printf '===== THREAD DUMP END %s =====\n' "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
} > "${WORK_DIR}/block"

install -d -o root -g root -m 0700 "${DIAG_DIR}"
if [[ -L "${OUTPUT_FILE}" || ( -e "${OUTPUT_FILE}" && ! -f "${OUTPUT_FILE}" ) ]]; then
    fail "${OUTPUT_FILE} 가 일반 파일이 아니다."
fi
if [[ ! -e "${OUTPUT_FILE}" ]]; then
    install -o root -g root -m 0600 /dev/null "${OUTPUT_FILE}"
fi
chown root:root "${OUTPUT_FILE}"
chmod 0600 "${OUTPUT_FILE}"

# 덧붙이다 실패하면 원래 크기로 되돌려 반쪽 덤프를 남기지 않는다.
ORIGINAL_SIZE="$(stat -c %s "${OUTPUT_FILE}")"
if ! cat "${WORK_DIR}/block" >> "${OUTPUT_FILE}"; then
    truncate -s "${ORIGINAL_SIZE}" "${OUTPUT_FILE}" || true
    fail "${OUTPUT_FILE} 에 쓰지 못했다."
fi

echo "Thread Dump 를 저장했다: ${OUTPUT_FILE} (PID=${PID}, ${STARTED_AT}, $(wc -l < "${WORK_DIR}/dump" | tr -d ' ')줄)"
