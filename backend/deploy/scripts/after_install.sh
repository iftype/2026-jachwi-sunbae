#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/opt/jachwi-sunbae
ENV_FILE=/etc/jachwi-sunbae/app.env
LOG_DIR=/var/log/jachwi-sunbae
SERVICE=jachwi-sunbae.service
RUN_USER=jachwi

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

if ! id "${RUN_USER}" &>/dev/null; then
    echo "실행 사용자가 없다: ${RUN_USER}" >&2
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

install -m 0644 "${APP_DIR}/${SERVICE}" "/etc/systemd/system/${SERVICE}"
systemctl daemon-reload
systemctl enable "${SERVICE}"

echo "${SERVICE} 를 설치했다."
