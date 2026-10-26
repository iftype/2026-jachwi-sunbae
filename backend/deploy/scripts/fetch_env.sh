#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077

if [[ "$#" != 1 ]]; then
  echo '사용법: fetch_env.sh <dev|prod>' >&2
  exit 1
fi

case "$1" in
  dev|prod)
    DEPLOY_ENV="$1"
    ;;
  *)
    echo "알 수 없는 배포 환경입니다: $1" >&2
    exit 1
    ;;
esac

VAULT_ROLE="jachwi-${DEPLOY_ENV}"
SECRET_PATH="jachwi-sunbae/${DEPLOY_ENV}"

export VAULT_ADDR='https://10.0.100.209:8200'
export VAULT_CACERT='/etc/jachwi-sunbae/vault-ca.crt'
export VAULT_CLIENT_TIMEOUT=15s
export VAULT_MAX_RETRIES=0
unset VAULT_TOKEN VAULT_SKIP_VERIFY VAULT_TLS_SERVER_NAME

ENV_DIR=/etc/jachwi-sunbae
ENV_FILE="${ENV_DIR}/app.env"
NONCE_FILE="${ENV_DIR}/vault-ec2-nonce"
FIREBASE_DIR="${ENV_DIR}/firebase"
FIREBASE_FILE="${FIREBASE_DIR}/service-account.json"

[[ "$(id -u)" == 0 ]] || {
  echo 'root 권한으로 실행해야 합니다.' >&2
  exit 1
}

install -d -m 0755 "${ENV_DIR}"

if [[ ! -e "${NONCE_FILE}" ]]; then
  openssl rand -hex 32 > "${NONCE_FILE}"
fi
chmod 0600 "${NONCE_FILE}"
test -s "${NONCE_FILE}"

IMDS_TOKEN=$(curl --fail --silent --show-error \
  --connect-timeout 3 --max-time 5 --noproxy '*' \
  -X PUT \
  -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' \
  http://169.254.169.254/latest/api/token)

EC2_SIGNATURE=$(curl --fail --silent --show-error \
  --connect-timeout 3 --max-time 5 --noproxy '*' \
  -H "X-aws-ec2-metadata-token: ${IMDS_TOKEN}" \
  http://169.254.169.254/latest/dynamic/instance-identity/rsa2048 \
  | tr -d '\n')
test -n "${EC2_SIGNATURE}"

LOGIN_RESPONSE=''

for attempt in {1..6}; do
  if LOGIN_RESPONSE=$(jq -n \
    --arg signature "${EC2_SIGNATURE}" \
    --arg role "${VAULT_ROLE}" \
    --rawfile nonce "${NONCE_FILE}" \
    '{
      role: $role,
      pkcs7: $signature,
      nonce: ($nonce | rtrimstr("\n"))
    }' | vault write -format=json auth/aws/login -); then
    break
  fi

  if (( attempt == 6 )); then
    echo 'Vault 인증 재시도 횟수를 초과했습니다.' >&2
    exit 1
  fi

  echo "Vault 인증 실패. 10초 후 재시도합니다 (${attempt}/6)." >&2
  sleep 10
done

VAULT_TOKEN=$(printf '%s' "${LOGIN_RESPONSE}" \
  | jq -er '.auth.client_token | select(length > 0)')
export VAULT_TOKEN
unset LOGIN_RESPONSE IMDS_TOKEN EC2_SIGNATURE

TEMP_DIR=$(mktemp -d "${ENV_DIR}/.vault.XXXXXX")
TEMP_FILE="${TEMP_DIR}/app.env"
SECRET_FILE="${TEMP_DIR}/secret.json"
FIREBASE_TEMP=''
trap 'rm -rf "${TEMP_DIR}"; rm -f "${FIREBASE_TEMP}"; unset VAULT_TOKEN' EXIT

if ! vault kv get -mount=secret -format=json "${SECRET_PATH}" > "${SECRET_FILE}" 2>/dev/null; then
  echo 'Vault 설정 조회에 실패했습니다.' >&2
  exit 1
fi

if ! jq -erj '.data.data.app_env | select(type == "string" and length > 0)' \
  "${SECRET_FILE}" > "${TEMP_FILE}" 2>/dev/null; then
  echo 'Vault app_env가 비어 있거나 형식이 올바르지 않습니다.' >&2
  exit 1
fi

for key in DB_HOST DB_PORT DB_NAME DB_USERNAME DB_PASSWORD JWT_SECRET; do
  if ! grep -Eq "^[[:space:]]*${key}[[:space:]]*=" "${TEMP_FILE}"; then
    echo "필수 환경변수 항목이 없습니다: ${key}" >&2
    exit 1
  fi
done

HAS_FIREBASE=$(jq -r '.data.data | has("firebase_service_account_json")' "${SECRET_FILE}" 2>/dev/null)
if [[ "${HAS_FIREBASE}" == true ]]; then
  install -d -o root -g jachwi -m 0750 "${FIREBASE_DIR}"
  FIREBASE_TEMP=$(mktemp "${FIREBASE_DIR}/.service-account.XXXXXX")
  if ! jq -er '.data.data.firebase_service_account_json | fromjson | objects' \
    "${SECRET_FILE}" > "${FIREBASE_TEMP}" 2>/dev/null; then
    echo 'Firebase 서비스 계정 JSON 형식이 올바르지 않습니다.' >&2
    exit 1
  fi
  chown root:jachwi "${FIREBASE_TEMP}"
  chmod 0640 "${FIREBASE_TEMP}"
fi

chown root:root "${TEMP_FILE}"
chmod 0600 "${TEMP_FILE}"

if [[ "${HAS_FIREBASE}" == true ]]; then
  mv -fT "${FIREBASE_TEMP}" "${FIREBASE_FILE}"
  echo 'Firebase 서비스 계정 파일을 갱신했습니다.'
else
  rm -f "${FIREBASE_FILE}"
  echo 'Firebase 서비스 계정 필드가 없어 파일 배치를 생략하고 이전 파일을 제거했습니다.'
fi
mv -fT "${TEMP_FILE}" "${ENV_FILE}"

echo "Vault에서 ${DEPLOY_ENV} app.env를 갱신했습니다."
