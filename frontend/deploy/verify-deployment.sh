#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=cache-headers.sh
source "${SCRIPT_DIR}/cache-headers.sh"

# CloudFront 전파가 늦을 수 있어 헤더가 다르면 기존 curl 재시도와 같은 횟수와 간격으로 다시 받는다.
HEADER_RETRIES="${VERIFY_HEADER_RETRIES:-12}"
HEADER_RETRY_DELAY="${VERIFY_HEADER_RETRY_DELAY:-5}"
# 경계 파일의 brotli 응답 확인은 기본으로 끈다. 경계 brotli 업로드가 배포된 뒤 VERIFY_BOUNDARY_BROTLI=1로 켠다.
VERIFY_BOUNDARY_BROTLI="${VERIFY_BOUNDARY_BROTLI:-0}"

LOCAL_INDEX="${1:?로컬 index.html 경로가 필요하다.}"
DEPLOYED_INDEX_URL="${2:?배포된 index.html URL이 필요하다.}"
EXPECTED_VERSION="${3:-}"

if [[ ! -f "${LOCAL_INDEX}" ]]; then
    echo "로컬 index.html이 없다: ${LOCAL_INDEX}" >&2
    exit 1
fi

EXPECTED_ASSETS="$({
    grep -oE '(src|href)="[^"]+\.(js|css)(\?[^"]*)?"' "${LOCAL_INDEX}" \
        | sed -E 's/^[^=]+="//; s/"$//' \
        | sort -u
} || true)"

if [[ -z "${EXPECTED_ASSETS}" ]]; then
    echo "로컬 index.html에서 JS 또는 CSS 파일명을 찾지 못했다: ${LOCAL_INDEX}" >&2
    exit 1
fi

DEPLOYED_INDEX="$(curl \
    -fsS \
    --retry 12 \
    --retry-all-errors \
    --retry-delay 5 \
    --max-time 10 \
    -H 'Cache-Control: no-cache' \
    "${DEPLOYED_INDEX_URL}")"

while IFS= read -r asset; do
    if ! grep -Fq "${asset}" <<< "${DEPLOYED_INDEX}"; then
        echo "배포된 index.html이 이번 빌드 파일을 참조하지 않는다: ${asset}" >&2
        exit 1
    fi
done <<< "${EXPECTED_ASSETS}"

echo "배포된 index.html에서 이번 빌드 파일을 확인했다:"
printf '%s\n' "${EXPECTED_ASSETS}"

if [[ -n "${EXPECTED_VERSION}" ]]; then
    VERSION_URL="${DEPLOYED_INDEX_URL%/index.html}/version.json"
    DEPLOYED_VERSION="$(curl \
        --fail \
        --silent \
        --show-error \
        --retry 12 \
        --retry-all-errors \
        --retry-delay 5 \
        --max-time 10 \
        -H 'Cache-Control: no-cache' \
        "${VERSION_URL}")"
    EXPECTED_VERSION_JSON="{\"version\":\"${EXPECTED_VERSION}\"}"
    if [[ "${DEPLOYED_VERSION}" != "${EXPECTED_VERSION_JSON}" ]]; then
        echo "배포된 버전이 이번 빌드와 다르다: expected=${EXPECTED_VERSION}, actual=${DEPLOYED_VERSION}" >&2
        exit 1
    fi
    echo "배포된 제품 버전을 확인했다: ${EXPECTED_VERSION}"
fi

BASE_URL="${DEPLOYED_INDEX_URL%/index.html}"

# 응답 헤더 값을 소문자 이름으로 찾아 앞뒤 공백과 CR을 지운 채 출력한다. 없으면 빈 문자열이다.
header_value() {
    local headers="$1" name="$2"
    awk -F': *' -v name="${name}" 'tolower($1) == name { sub(/\r$/, "", $2); print $2; exit }' <<< "${headers}"
}

fetch_headers() {
    local url="$1" accept_encoding="${2:-}"
    local args=(-fsS -I --max-time 10)
    if [[ -n "${accept_encoding}" ]]; then
        args+=(-H "Accept-Encoding: ${accept_encoding}")
    fi
    curl "${args[@]}" "${url}"
}

# check_header <라벨> <URL> <헤더 이름> <기대값> [Accept-Encoding]
# 다르면 무엇이 달랐는지 출력하고 재시도한다. 횟수를 다 쓰면 exit 1.
check_header() {
    local label="$1" url="$2" name="$3" expected="$4" accept_encoding="${5:-}"
    local attempt actual headers
    for ((attempt = 1; attempt <= HEADER_RETRIES; attempt++)); do
        if headers="$(fetch_headers "${url}" "${accept_encoding}" 2>&1)"; then
            actual="$(header_value "${headers}" "${name}")"
            if [[ "${actual}" == "${expected}" ]]; then
                printf '%s: %s 확인 (%s)\n' "${label}" "${name}" "${actual}"
                return 0
            fi
        else
            actual="요청 실패: ${headers}"
        fi
        if ((attempt < HEADER_RETRIES)); then
            sleep "${HEADER_RETRY_DELAY}"
        fi
    done
    {
        echo "${label}의 ${name}이 기대와 다르다."
        echo "  URL: ${url}"
        echo "  expected: ${expected}"
        echo "  actual:   ${actual:-<없음>}"
    } >&2
    FAILED=1
    return 0
}

FAILED=0

check_header 'index.html' "${BASE_URL}/index.html" cache-control "${CACHE_CONTROL_REVALIDATE}"
check_header 'version.json' "${BASE_URL}/version.json" cache-control "${CACHE_CONTROL_REVALIDATE}"

MAIN_JS="$(grep -E '^/?main\.[^/]*\.js(\?.*)?$' <<< "${EXPECTED_ASSETS}" | head -n 1 || true)"
if [[ -z "${MAIN_JS}" ]]; then
    echo "index.html에서 해시가 붙은 main JS를 찾지 못했다." >&2
    FAILED=1
else
    MAIN_JS="${MAIN_JS%%\?*}"
    check_header "main JS (${MAIN_JS})" "${BASE_URL}/${MAIN_JS#/}" cache-control "${CACHE_CONTROL_IMMUTABLE}"
fi

BOUNDARY_MANIFEST_URL="${BASE_URL}/boundaries/manifest.json"
check_header '경계 manifest' "${BOUNDARY_MANIFEST_URL}" cache-control "${CACHE_CONTROL_REVALIDATE}"

# legal-manifest.json은 있을 때만 올라가므로 배포본에 있을 때만 확인한다.
if curl -fsS -I --max-time 10 "${BASE_URL}/boundaries/legal-manifest.json" > /dev/null 2>&1; then
    check_header '경계 legal manifest' "${BASE_URL}/boundaries/legal-manifest.json" cache-control "${CACHE_CONTROL_REVALIDATE}"
fi

BOUNDARY_FILE="$({
    curl -fsS --retry 12 --retry-all-errors --retry-delay 5 --max-time 10 \
        -H 'Cache-Control: no-cache' "${BOUNDARY_MANIFEST_URL}" \
        | grep -oE '"file" *: *"[^"]+"' | head -n 1 | sed -E 's/^[^:]*: *"//; s/"$//'
} || true)"
if [[ -z "${BOUNDARY_FILE}" ]]; then
    echo "경계 manifest에서 해시 경계 파일 이름을 찾지 못했다: ${BOUNDARY_MANIFEST_URL}" >&2
    FAILED=1
else
    BOUNDARY_URL="${BASE_URL}/boundaries/${BOUNDARY_FILE}"
    check_header "경계 파일 (${BOUNDARY_FILE})" "${BOUNDARY_URL}" cache-control "${CACHE_CONTROL_IMMUTABLE}"
    if [[ "${VERIFY_BOUNDARY_BROTLI}" == "1" ]]; then
        check_header "경계 파일 (${BOUNDARY_FILE})" "${BOUNDARY_URL}" content-encoding br br
    fi
fi

if ((FAILED)); then
    echo "배포 응답 헤더 검증에 실패했다." >&2
    exit 1
fi
echo "배포 응답 헤더를 확인했다."
