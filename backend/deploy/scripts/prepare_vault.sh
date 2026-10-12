#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
CERT_SOURCE="${SCRIPT_DIR}/certs/vault-ca.crt"
ENV_DIR=/etc/jachwi-sunbae
VAULT_VERSION=2.1.1
VAULT_IP=10.0.100.209
REPO_URL=https://rpm.releases.hashicorp.com/AmazonLinux/hashicorp.repo

if [[ "$(id -u)" != 0 ]]; then
    echo 'Vault 클라이언트 준비는 root 권한으로 실행해야 합니다.' >&2
    exit 1
fi

if [[ ! -s "${CERT_SOURCE}" ]]; then
    echo "Vault 공개 인증서가 없습니다: ${CERT_SOURCE}" >&2
    exit 1
fi

for tool in jq openssl curl timeout; do
    if ! command -v "${tool}" >/dev/null 2>&1; then
        dnf install -y jq openssl curl coreutils
        break
    fi
done

openssl verify -CAfile "${CERT_SOURCE}" -verify_ip "${VAULT_IP}" "${CERT_SOURCE}"

REPO_TEMP=''
CERT_TEMP=''
trap 'rm -f "${REPO_TEMP}" "${CERT_TEMP}"' EXIT

INSTALLED_VERSION=$(rpm -q --qf '%{VERSION}' vault 2>/dev/null || true)
if [[ "${INSTALLED_VERSION}" != "${VAULT_VERSION}" ]]; then
    REPO_TEMP=$(mktemp)
    curl --fail --silent --show-error \
        --connect-timeout 5 --max-time 20 \
        "${REPO_URL}" -o "${REPO_TEMP}"
    install -o root -g root -m 0644 "${REPO_TEMP}" /etc/yum.repos.d/hashicorp.repo
    dnf install -y "vault-${VAULT_VERSION}"
fi

INSTALLED_VERSION=$(rpm -q --qf '%{VERSION}' vault)
if [[ "${INSTALLED_VERSION}" != "${VAULT_VERSION}" ]]; then
    echo "Vault 패키지 버전이 일치하지 않습니다. 필요한 버전: ${VAULT_VERSION}" >&2
    exit 1
fi

for tool in vault jq openssl curl timeout; do
    if ! command -v "${tool}" >/dev/null 2>&1; then
        echo "Vault 클라이언트 도구가 없습니다: ${tool}" >&2
        exit 1
    fi
done

install -d -o root -g root -m 0755 "${ENV_DIR}"
CERT_TEMP=$(mktemp "${ENV_DIR}/.vault-ca.crt.XXXXXX")
install -o root -g root -m 0644 "${CERT_SOURCE}" "${CERT_TEMP}"
mv -f "${CERT_TEMP}" "${ENV_DIR}/vault-ca.crt"

echo 'Vault 클라이언트 도구와 공개 인증서를 준비했습니다.'
