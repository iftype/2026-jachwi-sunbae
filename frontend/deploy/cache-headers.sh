#!/usr/bin/env bash
# publish.sh가 올릴 때 넣는 Cache-Control과 verify-deployment.sh가 배포 뒤 확인하는 값이 같은 곳에서 나오게 한다.
# 이 파일은 source로만 쓴다. 값을 바꾸면 업로드와 검증이 함께 바뀐다.

# 해시가 붙은 JS, CSS, 이미지, 경계 데이터. URL이 내용마다 달라 1년 동안 다시 검증하지 않는다.
CACHE_CONTROL_IMMUTABLE='public,max-age=31536000,immutable'

# index.html, version.json, 경계 manifest. 고정 URL이라 매번 재검증해 최신 해시 파일명을 받게 한다.
CACHE_CONTROL_REVALIDATE='no-cache,max-age=0,must-revalidate'
