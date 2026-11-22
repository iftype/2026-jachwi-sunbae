#!/usr/bin/env bash
# 로컬 프론트(webpack dev)를 띄운다. 기본은 mock(MSW)이라 dev 서버에 아무것도 남지 않는다. 쓰는 포트는 기본 3217. 이미 쓰는 포트면 실패한다(남의 서버를 죽이지 않는다).
# dev API 중계는 dev 서버에 익명 회원과 기록을 남기므로 --api dev 와 VERIFY_ALLOW_DEV_API=1 이 둘 다 있을 때만 켠다.
# 사용: .claude/skills/verify-jachwi/scripts/launch.sh [포트] [--api mock|dev]
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=3217; API=""
while [ $# -gt 0 ]; do
  case "$1" in
    --api) API="${2:-}"; shift 2 ;;
    *) PORT="$1"; shift ;;
  esac
done
MODE="$(node "$HERE/api-mode.mjs" ${API:+--api "$API"})" || exit 1
ROOT="$(git rev-parse --show-toplevel)"
STATE="${TMPDIR:-/tmp}/verify-jachwi-$PORT"
mkdir -p "$STATE"
port_busy() { if command -v ss >/dev/null 2>&1; then ss -ltn "sport = :$1" | grep -q LISTEN; else lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; fi; }  # macOS에는 ss가 없어 lsof를 쓴다
if port_busy "$PORT"; then echo "포트 $PORT 사용 중. 다른 포트를 주세요." >&2; exit 1; fi
cd "$ROOT/frontend"
[ -d node_modules ] || npm ci --no-audit --no-fund
# setsid가 없으면(macOS) 그냥 nohup으로 띄운다. cleanup이 자식까지 정리한다.
if command -v setsid >/dev/null 2>&1; then RUN=(setsid nohup); else RUN=(nohup); fi
if [ "$MODE" = dev ]; then
  PORT="$PORT" DEV_API_PROXY_TARGET=https://dev-api.jachwi-sunbae.kr API_BASE_URL=https://dev-api.jachwi-sunbae.kr \
    "${RUN[@]}" npm run dev > "$STATE/dev.log" 2>&1 &
else
  PORT="$PORT" "${RUN[@]}" npm run dev:mock > "$STATE/dev.log" 2>&1 &
fi
echo $! > "$STATE/pid"
for _ in $(seq 1 90); do
  if grep -q "compiled successfully" "$STATE/dev.log" 2>/dev/null; then echo "ready http://localhost:$PORT api=$MODE (pid $(cat "$STATE/pid"), log $STATE/dev.log)"; exit 0; fi
  sleep 1
done
echo "90초 안에 준비되지 않음: $STATE/dev.log" >&2; exit 1
