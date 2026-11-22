#!/usr/bin/env bash
# 비교할 커밋 하나를 따로 꺼내 운영 빌드한다. 전후 판정과 기준 스크린샷의 입력이다.
# 사용: build-variant.sh <이름> <git ref> <포트>
#   예: build-variant.sh before upstream/develop 4301 && build-variant.sh after HEAD 4302
# 결과: ${TMPDIR:-/tmp}/verify-jachwi-variants/<이름>/frontend/dist (API 주소는 http://localhost:<포트> 로 박힌다)
# serve.mjs 를 같은 포트로 띄워야 API가 닿는다. 지우기: git worktree remove --force <폴더>
set -euo pipefail
NAME="$1"; REF="$2"; PORT="$3"
ROOT="$(git rev-parse --show-toplevel)"
BASE="${TMPDIR:-/tmp}/verify-jachwi-variants"
DIR="$BASE/$NAME"
mkdir -p "$BASE"
SHA="$(git rev-parse --verify "$REF^{commit}")"
if [ -d "$DIR" ]; then git -C "$DIR" checkout --quiet --detach "$SHA"; else git worktree add --quiet --detach "$DIR" "$SHA"; fi
# 네이버 지도 키. 운영 빌드는 늘 실제 지도라 키가 있어야 지도가 뜬다. 이 파일은 커밋하지 않는다.
[ -f "$ROOT/frontend/.env.local" ] && cp "$ROOT/frontend/.env.local" "$DIR/frontend/.env.local"
cd "$DIR/frontend"
if [ ! -d node_modules ] || ! cmp -s package-lock.json node_modules/.package-lock-src 2>/dev/null; then
  npm ci --no-audit --no-fund --loglevel=error
  cp package-lock.json node_modules/.package-lock-src
fi
API_BASE_URL="http://localhost:$PORT" npm run build:bundle --silent > "$BASE/$NAME.build.log" 2>&1 \
  || { echo "빌드 실패: $BASE/$NAME.build.log" >&2; exit 1; }
echo "$NAME $SHA $DIR/frontend/dist port=$PORT"
