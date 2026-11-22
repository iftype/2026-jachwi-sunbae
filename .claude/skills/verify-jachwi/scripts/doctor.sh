#!/usr/bin/env bash
# 읽기 전용. 이 인스턴스를 구동할 가치가 있는지 본다. 기본은 mock 점검이다(dev 서버를 부르지 않는다).
# dev API 점검은 --api dev 와 VERIFY_ALLOW_DEV_API=1 이 둘 다 있을 때만 한다(익명 로그인이 dev 서버에 회원을 만든다).
# 사용: doctor.sh [포트] [--api mock|dev]
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=3217; API=""
while [ $# -gt 0 ]; do
  case "$1" in
    --api) API="${2:-}"; shift 2 ;;
    *) PORT="$1"; shift ;;
  esac
done
MODE="$(node "$HERE/api-mode.mjs" ${API:+--api "$API"})" || exit 1
STATE="${TMPDIR:-/tmp}/verify-jachwi-$PORT"
fail=0
pid="$(cat "$STATE/pid" 2>/dev/null)"
if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then echo "ok   프로세스 $pid 살아 있음"; else echo "FAIL 이 스킬이 띄운 서버가 아님(pid 파일 없음). 남의 서버는 구동하지 않는다"; fail=1; fi
[ "$(curl -s -o /dev/null -w '%{http_code}' "localhost:$PORT/")" = 200 ] && echo "ok   프론트 200" || { echo "FAIL 프론트 응답 없음"; fail=1; }
if [ "$MODE" = mock ]; then
  echo "ok   mock 모드: dev API를 부르지 않는다"
  exit $fail
fi
curl -s -m 10 https://dev-api.jachwi-sunbae.kr/actuator/info | grep -o '"commit":"[^"]*"' | sed 's/^/ok   dev API /' || { echo "FAIL dev API 응답 없음"; fail=1; }
code="$(curl -s -m 10 -o /dev/null -w '%{http_code}' -X POST "localhost:$PORT/api/auth/login")"
[ "$code" = 200 ] && echo "ok   프록시 경유 익명 로그인 200" || { echo "FAIL 프록시 로그인 $code (API가 HTML을 주면 포트를 다른 앱이 잡은 것)"; fail=1; }
exit $fail
