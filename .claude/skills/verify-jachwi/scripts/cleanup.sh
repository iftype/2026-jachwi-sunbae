#!/usr/bin/env bash
# launch.sh가 띄운 서버만 종료한다(이름으로 죽이지 않는다). 증거(qa/runs/verify-jachwi/)는 지우지 않는다. 사용: cleanup.sh [포트]
PORT="${1:-3217}"
STATE="${TMPDIR:-/tmp}/verify-jachwi-$PORT"
pid="$(cat "$STATE/pid" 2>/dev/null)" || { echo "pid 파일 없음, 할 일 없음"; exit 0; }
# setsid가 있으면 pid가 프로세스 그룹 id라 그룹만 종료한다. 없으면(macOS) 우리 pid와 그 자손만 종료한다. 이름으로 죽이지 않는다
if command -v setsid >/dev/null 2>&1; then
  kill -- "-$pid" 2>/dev/null
else
  descend() { for c in $(pgrep -P "$1" 2>/dev/null); do descend "$c"; done; kill "$1" 2>/dev/null; }
  descend "$pid"
fi
port_busy() { if command -v ss >/dev/null 2>&1; then ss -ltn "sport = :$1" | grep -q LISTEN; else lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; fi; }
sleep 1; port_busy "$PORT" && echo "포트 $PORT 아직 사용 중: ss -ltnp 또는 lsof -nP -iTCP:포트 로 소유자를 확인해 직접 종료" || echo "종료됨"
rm -rf "$STATE"
