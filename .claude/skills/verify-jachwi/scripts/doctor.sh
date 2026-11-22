#!/usr/bin/env bash
# 읽기 전용. 이 인스턴스를 구동할 가치가 있는지 본다. 사용: doctor.sh [포트]
PORT="${1:-3217}"
STATE="${TMPDIR:-/tmp}/verify-jachwi-$PORT"
fail=0
pid="$(cat "$STATE/pid" 2>/dev/null)"
if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then echo "ok   프로세스 $pid 살아 있음"; else echo "FAIL 이 스킬이 띄운 서버가 아님(pid 파일 없음). 남의 서버는 구동하지 않는다"; fail=1; fi
[ "$(curl -s -o /dev/null -w '%{http_code}' "localhost:$PORT/")" = 200 ] && echo "ok   프론트 200" || { echo "FAIL 프론트 응답 없음"; fail=1; }
curl -s -m 10 https://dev-api.jachwi-sunbae.kr/actuator/info | grep -o '"commit":"[^"]*"' | sed 's/^/ok   dev API /' || { echo "FAIL dev API 응답 없음"; fail=1; }
code="$(curl -s -m 10 -o /dev/null -w '%{http_code}' -X POST "localhost:$PORT/api/auth/login")"
[ "$code" = 200 ] && echo "ok   프록시 경유 익명 로그인 200" || { echo "FAIL 프록시 로그인 $code (API가 HTML을 주면 포트를 다른 앱이 잡은 것)"; fail=1; }
exit $fail
