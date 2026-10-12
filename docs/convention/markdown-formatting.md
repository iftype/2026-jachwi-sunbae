# Markdown 작성 규칙

개발자와 AI가 작성하는 Markdown은 저장소 루트의 Prettier 설정으로 정렬한다.  
IDE의 저장 시 자동 포맷팅은 편의 기능이며, 최종 기준은 루트에서 실행한 `npm run format:docs:check` 결과다.

## 설치와 실행

Node.js는 [frontend/.nvmrc](../../frontend/.nvmrc)에 지정한 버전을 사용한다.
아래 명령은 모두 **저장소 루트**에서 실행한다.

최초 사용하거나 루트 의존성이 바뀌면 설치한다.

```bash
npm ci
```

문서를 작성 및 수정한 뒤 정렬하고, 커밋 전에 변경 내용을 확인한다.

```bash
npm run format:docs
git diff
npm run format:docs:check
```

- `format:docs`는 관리 대상 문서 전체를 정렬하고 파일을 수정한다.
- `format:docs:check`는 파일을 수정하지 않으며, 포맷 위반이 있으면 실패한다.
- 새 파일은 `git diff`에 표시되지 않을 수 있으므로 `git status --short`와 파일 내용도 확인한다.
- 작업과 무관한 변경이나 문서 의미가 달라진 부분이 없는지 확인한다.
- PR 생성 전에는 `format:docs:check`를 실행한다. AI도 같은 명령을 사용하며 포맷팅 규칙을 임의로 바꾸거나 검사를 생략하지 않는다.

## Markdown CI

[markdown-format.yml](../../.github/workflows/markdown-format.yml)의 워크플로 이름은 `Markdown CI`, 검사 이름은 `Check Markdown`이다.
Backend CI, Frontend CI와 별도로 루트 의존성을 설치하고 `npm run format:docs:check`를 실행한다.

- `main`, `develop` 대상 PR과 두 브랜치의 push에서 실행한다.
- 수동 실행을 지원한다.
- 변경 경로 필터가 없으므로 Java나 프론트엔드 코드만 수정한 PR에서도 관리 대상 Markdown 전체를 검사한다.
- CI는 문서를 자동 수정하거나 커밋하지 않는다.

### 포맷 검사 실패 시

검사 로그의 파일 목록을 확인하고 루트에서 다음 순서로 실행한다.

```bash
npm run format:docs
git diff
npm run format:docs:check
```

검사가 통과하면 정렬된 파일을 커밋하고 다시 push한다. `prettier`를 찾을 수 없으면 루트에서 `npm ci`를 먼저 실행한다.  
포맷팅 후에도 검사에 실패하면 로그에서 Markdown 구문 오류나 설치 실패 여부를 확인한다.
