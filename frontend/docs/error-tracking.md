# 에러 트래킹 등급

PostHog 예외 이벤트의 `severity`는 일반 미처리·화면 오류 `P0`, 서버·응답 계약 오류 `P1`, 네트워크 오류 `P2`로 분류한다.

청크 로딩 실패는 자동 수집과 라우트 오류 경계의 수동 수집 모두 `severity=P2`, `error_category=chunk_load`로 전송한다. `ChunkLoadError` 타입 또는 Webpack의 `Loading chunk … failed` / `Loading CSS chunk … failed` 메시지만 대상으로 삼으며, 다른 오류의 등급은 낮추지 않는다. 수집을 차단하지 않고 기존 새로고침 안내도 유지한다.

배포 시 이전 청크는 기존 정책대로 삭제한다. 등급 하향은 오류 복구나 청크 보존을 의미하지 않는다.

이벤트의 사용자 정의 `severity` 속성과 PostHog Error Tracking 이슈의 Low/Medium/High 등급은 별개다. 기존 이슈 등급과 알림 조건은 PostHog에서 별도로 관리한다. 이벤트 등급만 바꾸어도 기존 Discord 알림이 자동으로 꺼지는 것은 아니다.
