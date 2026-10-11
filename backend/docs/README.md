# 백엔드 문서

백엔드 코드와 함께 변경되어야 하는 실행 방법, 운영 절차와 팀 합의를 `backend/docs`에서 버전 관리한다.

| 디렉터리                                                | 책임                                                    |
| ------------------------------------------------------- | ------------------------------------------------------- |
| [`guides`](guides/local-development.md)                 | 개발자가 그대로 따라 할 수 있는 실행 절차               |
| [`conventions`](conventions/backend-code-convention.md) | 팀이 반복해서 적용하는 코드·API·예외 규칙과 패키지 구조 |
| [`operations`](operations/deployment.md)                | 배포, 롤백, 모니터링과 장애 대응 절차                   |

## 현재 기준 문서

- [로컬 개발](guides/local-development.md)
- [환경변수](guides/environment-variables.md)
- [백엔드 코드 컨벤션](conventions/backend-code-convention.md)
- [백엔드 패키지 구조](conventions/backend-package-structure.md)
- [API 컨벤션](conventions/api-convention.md)
- [예외 컨벤션](conventions/exception-convention.md)
- [백엔드 배포](operations/deployment.md)
- [롤백](operations/rollback.md)
- [모니터링](operations/monitoring.md)
- [장애 대응](operations/incident-response.md)
- [프론트엔드 배포](../../frontend/docs/deployment.md)
- [Git·GitHub 협업 컨벤션](../../docs/convention/README.md)

## 문서 작성 원칙

- 현재 지켜야 할 코드 규칙과 패키지 구조는 컨벤션에 기록한다.
- 명령을 따라 하는 절차는 가이드에 기록한다.
- 아직 결정하지 않은 내용은 추측해 확정하지 않고 `미정` 또는 `초안`으로 표시한다.
- 코드나 설정이 바뀌면 같은 PR에서 관련 문서를 함께 수정한다.
- 파일명은 영문 `kebab-case`를 기본으로 사용한다.
- Markdown 정렬과 검사는 [공통 Markdown 작성 규칙](../../docs/convention/markdown-formatting.md)에 따라 저장소 루트에서 실행한다.
