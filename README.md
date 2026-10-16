# 자취선배

> **집은 매물 앱에서 찾고, 결정은 자취선배에서.**

여러 플랫폼에서 찾은 매물 후보를 한곳에 모으고, 방문 전·현장·계약 전 확인 내용을 사진과 메모로 기록해 비교하도록 돕는 임차인용 집 선택 도구입니다.

외부 계정 없이 닉네임만으로 시작할 수 있고, 기록 보호가 필요하면 선택 비밀번호를 설정합니다. 매물별 체크리스트, 실제 사진 업로드, 주소·지도·주변 시설 분석, 선택 매물 비교 PDF와 외부 사용자용 공개 소개
화면을 제공합니다.

## 실행 환경

| 환경 | 브랜치    | 프론트엔드                     | 백엔드                             |
| ---- | --------- | ------------------------------ | ---------------------------------- |
| dev  | `develop` | `https://dev.jachwi-sunbae.kr` | `https://dev-api.jachwi-sunbae.kr` |
| prod | `main`    | `https://www.jachwi-sunbae.kr` | `https://api.jachwi-sunbae.kr`     |

`develop`과 `main` 병합은 GitHub Actions 필수 검사를 거칩니다. 배포는 팀 AWS 계정의 CodePipeline Commands, CodeDeploy, S3와 CloudFront가 담당하며
실제 비밀값은 저장소에 커밋하지 않습니다.

## 문서

### 제품

- [제품 문서 안내](docs/product/README.md) — 기능별 요구사항·정책·인수 기준

### QA

- [QA 안내](qa/README.md) — AI E2E QA 사이클, 정답 기준, 사용자 흐름, Scenario, 실행 결과 형식과 판정 기준, 실행 방법

### 개발과 운영

- [컨벤션](docs/convention/README.md) — 브랜치·커밋, 이슈·PR, 코드 리뷰
- [Markdown 작성 규칙](docs/convention/markdown-formatting.md) — 루트 포맷팅 명령, IDE 주의사항, Markdown CI
- [변경 내역](CHANGELOG.md) — 릴리스별 기능·수정·성능 개선
- [버전 관리](docs/convention/versioning.md) — SemVer, Git 태그, 릴리스와 롤백 기준
- [백엔드 문서](backend/docs/README.md) — 코드·API·예외 컨벤션, 패키지 구조, 환경변수·로컬 실행·운영
- [환경변수](backend/docs/guides/environment-variables.md)와 [프론트엔드 공개 빌드 설정](frontend/README.md#공개-빌드-설정)
- [백엔드 배포](backend/docs/operations/deployment.md)와 [프론트엔드 배포](frontend/docs/deployment.md)

## 저장소 구조

```text
2026-jachwi-sunbae/
├── .github/              # Issue·PR 템플릿, 백엔드·프론트엔드·Markdown CI
├── backend/              # Spring Boot, MySQL, MinIO, CodeDeploy 파일
├── frontend/             # React, TypeScript, Webpack, S3·CloudFront 배포 파일
├── qa/                   # AI E2E QA 기준 문서(docs/)와 Playwright 실행 코드
├── docs/
│   ├── convention/       # 저장소 공통 규칙
│   └── product/          # 제품 기능 명세
├── .editorconfig
├── .gitignore
├── .prettierignore
├── .prettierrc.json
├── AGENTS.md
├── CLAUDE.md
├── package.json          # Markdown 포맷팅 도구와 실행 명령
├── package-lock.json
└── README.md
```

## 로컬 실행

외부 키 없이 demo 지도와 MinIO를 사용합니다.

```bash
cd backend
cp .env.example .env
set -a
source .env
set +a
docker compose up -d
./gradlew bootRun
```

다른 터미널에서 실행합니다.

```bash
cd frontend
cp .env.example .env.local
npm ci
npm run dev
```

- 앱: `http://localhost:3000`
- Swagger UI: `http://localhost:8080/swagger-ui/index.html`
- MinIO 콘솔: `http://localhost:9001`

처음 보는 닉네임은 새 기록 공간을 만듭니다. 비밀번호를 비우면 같은 닉네임을 아는 사람이 기록을 함께 수정할 수 있고, 비밀번호를 입력하면 같은 닉네임이라도 비밀번호 없는 기록과 분리된 보호 기록을 사용합니다.
