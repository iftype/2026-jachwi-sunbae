# 자취선배

Spring Boot 백엔드와 프론트엔드를 함께 관리하는 모노레포다.

- `develop`에서 작업 브랜치를 분기한다. `main`과 `develop`에 직접 작업하거나 푸시하지 않는다.
- 커밋 메시지는 `<type>: 변경 내용` 형식의 한국어 Conventional Commits를 사용한다.
- PR 제목은 `[파트][작업 종류] 작업 내용` 형식을 사용한다. 예: `[BE][Feat] 예약 생성 기능을 구현한다`
- 작업 전에 저장소 공통 컨벤션과 해당 파트의 컨벤션을 확인한다.
- Markdown 포맷팅은 저장소 루트의 Prettier 설정과 [Markdown 작성 규칙](docs/convention/markdown-formatting.md)을 따른다.
- Markdown 작성 및 수정 후 저장소 루트에서 `npm run format:docs`를 실행한다.
- PR을 생성하기 전 저장소 루트에서 `npm run format:docs:check`를 실행한다.
- 포맷팅 규칙을 임의로 변경하거나 검사를 생략하지 않는다.
- 포맷팅 후 Git diff를 확인하고 작업과 무관한 변경은 포함하지 않는다.
- 변경 범위에 필요한 테스트와 검사를 실행한다.
- 기능이나 사용법이 바뀌면 관련 문서도 같은 PR에서 수정한다.
- `AGENTS.md`와 `CLAUDE.md`는 같은 내용으로 유지한다.
