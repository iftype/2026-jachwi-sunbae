#!/usr/bin/env bash
# launch.sh가 띄운 서버만 종료한다(이름으로 죽이지 않는다). 증거(qa/runs/verify-jachwi/)는 지우지 않는다. 사용: cleanup.sh [포트]
PORT="${1:-3217}"
STATE="${TMPDIR:-/tmp}/verify-jachwi-$PORT"
pid="$(cat "$STATE/pid" 2>/dev/null)" || { echo "pid 파일 없음, 할 일 없음"; exit 0; }
# launch.sh가 setsid로 띄워 pid가 프로세스 그룹 id다. 그룹만 종료하므로 남의 서버는 건드리지 않는다
kill -- "-$pid" 2>/dev/null
sleep 1; ss -ltn "sport = :$PORT" | grep -q LISTEN && echo "포트 $PORT 아직 사용 중: ss -ltnp 로 소유자를 확인해 직접 종료" || echo "종료됨"
rm -rf "$STATE"
