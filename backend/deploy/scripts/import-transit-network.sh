#!/usr/bin/env bash
set -euo pipefail

APP_DIR=/opt/jachwi-sunbae
ENV_FILE=/etc/jachwi-sunbae/app.env
RUN_USER=jachwi

if [[ "${EUID}" -ne 0 ]]; then
    echo "운영 환경변수를 사용하려면 sudo로 실행해 주세요." >&2
    exit 1
fi

if [[ ! -f "${APP_DIR}/app.jar" || ! -f "${ENV_FILE}" ]]; then
    echo "배포된 app.jar 또는 운영 환경변수 파일이 없습니다." >&2
    exit 1
fi

exec systemd-run --quiet --wait --pipe --collect --service-type=exec \
    --unit="jachwi-transit-import-$(date +%s)-$$" \
    --property="User=${RUN_USER}" \
    --property="Group=${RUN_USER}" \
    --property="EnvironmentFile=${ENV_FILE}" \
    --property="WorkingDirectory=${APP_DIR}" \
    /usr/bin/java -XX:MaxRAMPercentage=50.0 \
    -Dloader.main=com.jachwisunbae.transit.importer.TransitImportCommand \
    -cp "${APP_DIR}/app.jar" \
    org.springframework.boot.loader.launch.PropertiesLauncher "$@"
