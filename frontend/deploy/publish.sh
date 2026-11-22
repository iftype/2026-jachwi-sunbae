#!/usr/bin/env bash
set -euo pipefail

DEPLOY_ENVIRONMENT="${1:?배포 환경은 dev 또는 prod여야 한다.}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="${SCRIPT_DIR}/../dist"
# shellcheck source=cache-headers.sh
source "${SCRIPT_DIR}/cache-headers.sh"
LOCAL_INDEX="${DIST_DIR}/index.html"
VERSION_FILE="${SCRIPT_DIR}/../../VERSION"

case "${DEPLOY_ENVIRONMENT}" in
    dev)
        S3_URI=s3://techcourse-project-2026/jachwi-sunbae/web-dev/
        DISTRIBUTION_ID=ETE1HH7V9K0PO
        DEPLOYED_INDEX_URL=https://dev.jachwi-sunbae.kr/index.html
        ;;
    prod)
        S3_URI=s3://techcourse-project-2026/jachwi-sunbae/web/
        DISTRIBUTION_ID=E3LI41UZ24V9WD
        DEPLOYED_INDEX_URL=https://www.jachwi-sunbae.kr/index.html
        ;;
    *)
        echo "알 수 없는 배포 환경이다: ${DEPLOY_ENVIRONMENT}" >&2
        exit 1
        ;;
esac

if [[ ! -f "${LOCAL_INDEX}" ]]; then
  echo "프론트엔드 빌드 결과가 없다: ${LOCAL_INDEX}" >&2
  exit 1
fi

if [[ -n "${POSTHOG_CLI_API_KEY:-}" ]]; then
  "${SCRIPT_DIR}/upload-posthog-sourcemaps.sh"
else
  echo "PostHog source map 업로드를 건너뛴다: POSTHOG_CLI_API_KEY가 없다." >&2
fi

VERSION="$(tr -d '[:space:]' < "${VERSION_FILE}")"
printf '{"version":"%s"}\n' "${VERSION}" > "${DIST_DIR}/version.json"

# dev는 robots.txt, sitemap.xml, index.html의 noindex를 고치고, prod는 noindex가 없는지 확인한다.
"${SCRIPT_DIR}/prepare-seo-files.sh" "${DEPLOY_ENVIRONMENT}" "${DIST_DIR}"

export AWS_PAGER=""

aws s3 sync "${DIST_DIR}/" "${S3_URI}" \
    --delete \
    --exclude '*.map' \
    --exclude 'index.html' \
    --exclude 'version.json' \
    --exclude 'robots.txt' \
    --exclude 'sitemap.xml' \
    --exclude 'boundaries/*' \
    --cache-control "${CACHE_CONTROL_IMMUTABLE}"

# 이전 해시 객체는 유지한다. 경계 파일을 먼저 올리고 manifest를 마지막에 교체한다.
for BOUNDARY_GZIP in "${DIST_DIR}"/boundaries/*.geojson.gz; do
    [[ -f "${BOUNDARY_GZIP}" ]] || continue
    BOUNDARY_FILENAME="$(basename "${BOUNDARY_GZIP}" .gz)"
    aws s3 cp "${BOUNDARY_GZIP}" "${S3_URI}boundaries/${BOUNDARY_FILENAME}" \
        --content-type 'application/geo+json' \
        --content-encoding 'gzip' \
        --cache-control "${CACHE_CONTROL_IMMUTABLE}"
done

for BOUNDARY_MANIFEST in manifest.json legal-manifest.json; do
  if [[ -f "${DIST_DIR}/boundaries/${BOUNDARY_MANIFEST}" ]]; then
    aws s3 cp "${DIST_DIR}/boundaries/${BOUNDARY_MANIFEST}" "${S3_URI}boundaries/${BOUNDARY_MANIFEST}" \
        --content-type 'application/json; charset=utf-8' \
        --cache-control "${CACHE_CONTROL_REVALIDATE}"
  fi
done

aws s3 cp "${LOCAL_INDEX}" "${S3_URI}index.html" \
    --cache-control "${CACHE_CONTROL_REVALIDATE}" \
    --content-type 'text/html; charset=utf-8'

aws s3 cp "${DIST_DIR}/version.json" "${S3_URI}version.json" \
    --cache-control "${CACHE_CONTROL_REVALIDATE}" \
    --content-type 'application/json; charset=utf-8'

# 파일명에 해시가 없어 내용을 바꾸면 바로 보여야 하므로 index.html처럼 캐시하지 않는다.
aws s3 cp "${DIST_DIR}/robots.txt" "${S3_URI}robots.txt" \
    --cache-control "${CACHE_CONTROL_REVALIDATE}" \
    --content-type 'text/plain; charset=utf-8'

if [[ -f "${DIST_DIR}/sitemap.xml" ]]; then
    aws s3 cp "${DIST_DIR}/sitemap.xml" "${S3_URI}sitemap.xml" \
        --cache-control "${CACHE_CONTROL_REVALIDATE}" \
        --content-type 'application/xml; charset=utf-8'
fi

INVALIDATION_ID="$(aws cloudfront create-invalidation \
    --distribution-id "${DISTRIBUTION_ID}" \
    --paths '/index.html' '/version.json' '/robots.txt' '/sitemap.xml' '/boundaries/manifest.json' '/boundaries/legal-manifest.json' \
    --query 'Invalidation.Id' \
    --output text)"

if [[ -z "${INVALIDATION_ID}" || "${INVALIDATION_ID}" == "None" ]]; then
    echo "CloudFront 무효화 ID를 받지 못했다." >&2
    exit 1
fi

aws cloudfront wait invalidation-completed \
    --distribution-id "${DISTRIBUTION_ID}" \
    --id "${INVALIDATION_ID}"

"${SCRIPT_DIR}/verify-deployment.sh" "${LOCAL_INDEX}" "${DEPLOYED_INDEX_URL}" "${VERSION}"
