#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/opt/jachwi-sunbae
ENV_FILE=/etc/jachwi-sunbae/app.env
LOG_DIR=/var/log/jachwi-sunbae
SERVICE=jachwi-sunbae.service
RUN_USER=jachwi
DIAG_DIR=/var/log/jachwi-diagnostics
THREAD_DUMP_SOURCE="${APP_DIR}/scripts/jachwi-thread-dump.sh"
THREAD_DUMP_BIN=/usr/local/sbin/jachwi-thread-dump
THREAD_DUMP_LOGROTATE_SOURCE="${APP_DIR}/scripts/jachwi-thread-dumps.logrotate"
THREAD_DUMP_LOGROTATE=/etc/logrotate.d/jachwi-thread-dumps

case "${DEPLOYMENT_GROUP_NAME:-}" in
    jachwi-sunbae-dev-group)
        DEPLOY_ENV=dev
        ;;
    jachwi-sunbae-codeDeploy-group)
        DEPLOY_ENV=prod
        ;;
    *)
        echo "알 수 없는 배포 그룹입니다: ${DEPLOYMENT_GROUP_NAME:-미설정}" >&2
        exit 1
        ;;
esac

# Firebase 파일을 root:jachwi로 만들기 전에 AMI의 실행 사용자·그룹을 확인한다.
if ! id "${RUN_USER}" &>/dev/null || ! getent group "${RUN_USER}" >/dev/null; then
    echo "실행 사용자 또는 그룹이 없다: ${RUN_USER}" >&2
    exit 1
fi

timeout --kill-after=5s 180s \
    bash "${APP_DIR}/scripts/prepare_vault.sh"
timeout --kill-after=5s 180s \
    bash "${APP_DIR}/scripts/fetch_env.sh" "${DEPLOY_ENV}"

# 환경변수를 준비한 뒤 파일 존재 여부를 확인한다.
# 없으면 애플리케이션이 기동 도중에 죽으므로 여기서 먼저 멈춘다.
if [[ ! -f "${ENV_FILE}" ]]; then
    echo "운영 환경변수 파일이 없다: ${ENV_FILE}" >&2
    exit 1
fi

chown -R "${RUN_USER}:${RUN_USER}" "${APP_DIR}"
chmod 0640 "${APP_DIR}/app.jar"
chmod 0755 "${APP_DIR}"/scripts/*.sh

install -d -o "${RUN_USER}" -g "${RUN_USER}" -m 0750 "${LOG_DIR}"
install -d -o "${RUN_USER}" -g "${RUN_USER}" -m 0750 "${LOG_DIR}/archive"
touch "${LOG_DIR}/service-events.log"
chown "${RUN_USER}:${RUN_USER}" "${LOG_DIR}/service-events.log"
chmod 0640 "${LOG_DIR}/service-events.log"
# JVM 은 GC 로그 파일을 열지 못하면 기동하지 않는다. 남아 있는 GC 로그를 실행 사용자 소유로 맞춘다.
find "${LOG_DIR}" -maxdepth 1 -type f -name 'gc.log*' -exec chown "${RUN_USER}:${RUN_USER}" {} +

# 진단 도구는 root 소유로 따로 설치한다. 배포 디렉터리는 실행 사용자 소유라 그대로 실행하지 않는다.
# 진단 디렉터리는 BeforeInstall 이 비우는 경로 밖에 있고, 기존 thread-dumps.log 는 건드리지 않는다.
for file in "${THREAD_DUMP_SOURCE}" "${THREAD_DUMP_LOGROTATE_SOURCE}"; do
    if [[ ! -s "${file}" ]]; then
        echo "배포 산출물에 진단 도구 파일이 없다: ${file}" >&2
        exit 1
    fi
done
if [[ ! -d /etc/logrotate.d ]] || ! command -v logrotate &>/dev/null; then
    echo "logrotate 가 설치되어 있지 않다. Thread Dump 로그를 순환할 수 없다." >&2
    exit 1
fi
install -d -o root -g root -m 0700 "${DIAG_DIR}"
install -o root -g root -m 0755 "${THREAD_DUMP_SOURCE}" "${THREAD_DUMP_BIN}"
install -o root -g root -m 0644 "${THREAD_DUMP_LOGROTATE_SOURCE}" "${THREAD_DUMP_LOGROTATE}"
if ! logrotate --debug "${THREAD_DUMP_LOGROTATE}" &>/dev/null; then
    echo "logrotate 설정 검증에 실패했다: ${THREAD_DUMP_LOGROTATE}" >&2
    exit 1
fi

install -m 0644 "${APP_DIR}/${SERVICE}" "/etc/systemd/system/${SERVICE}"
systemctl daemon-reload
systemctl enable "${SERVICE}"

echo "${SERVICE} 를 설치했다."
