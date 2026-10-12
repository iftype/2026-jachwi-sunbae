# 프론트엔드 배포

- 상태: 동작 중
- 현재 배포 환경: prod `https://www.jachwi-sunbae.kr`, dev `https://dev.jachwi-sunbae.kr`

이 문서는 프론트엔드 배포 구성과 절차를 적는다.

## 배포 경로

```text
develop 병합                          main 병합
  → jachwi-sunbae-dev-web-line          → jachwi-sunbae-web-line
    → Commands 액션                       → Commands 액션
        npm ci && npm run build               npm ci && npm run build
        publish.sh dev                       publish.sh prod
          → 정적 자산 장기 캐시 업로드             → 정적 자산 장기 캐시 업로드
          → index.html 재검증 업로드              → index.html 재검증 업로드
          → index.html 무효화·완료 대기         → index.html 무효화·완료 대기
          → 실제 번들 파일명 확인               → 실제 번들 파일명 확인
  → dev CloudFront                      → prod CloudFront
```

백엔드와 **별도 파이프라인**이다. 한쪽 실패가 다른 쪽 배포를 막지 않는다. 환경끼리도 별도다.

두 파이프라인은 같은 빌드 명령을 쓰고 마지막 배포 명령의 환경 인자만 다르다.

```bash
./frontend/deploy/publish.sh dev
./frontend/deploy/publish.sh prod
```

스크립트가 환경별 S3 경로, CloudFront 배포 ID, 서비스 URL의 조합을 고정한다. 세 값을 콘솔에 각각 적지 않아 환경끼리 섞이는 설정을 줄인다.

**`s3 sync`의 대상 경로를 틀리면 상대 환경을 덮어쓴다.** `--delete`가 붙어 있어 dev 빌드가 prod 사이트를 통째로 바꿔버린다. 이 한 줄이 가장 위험한 지점이다.

## 환경별 구성

| 항목              | prod                     | dev                          |
| ----------------- | ------------------------ | ---------------------------- |
| 도메인            | `www.jachwi-sunbae.kr`   | `dev.jachwi-sunbae.kr`       |
| CloudFront        | `E3LI41UZ24V9WD`         | `ETE1HH7V9K0PO`              |
| origin path       | `/jachwi-sunbae/web`     | `/jachwi-sunbae/web-dev`     |
| S3 경로           | `jachwi-sunbae/web/`     | `jachwi-sunbae/web-dev/`     |
| 파이프라인        | `jachwi-sunbae-web-line` | `jachwi-sunbae-dev-web-line` |
| 소스 브랜치       | `main`                   | `develop`                    |
| ACM (`us-east-1`) | `.../b7e879e2-...`       | `.../0206679e-...`           |

S3 버킷과 ACM 발급 리전은 같다. 나머지가 전부 갈린다.

두 환경이 실제로 갈렸는지는 번들 해시로 확인한다.

```
dev  → /main.246e7100080c6647405f.js
prod → /main.8a49163cbe52bf996d07.js
```

## 환경변수는 빌드 타임에 박힌다

`webpack.config.js`의 `DefinePlugin`이 `API_BASE_URL`·`MAP_PROVIDER_MODE`·`NAVER_MAP_CLIENT_ID`·`ENABLE_MSW`·`POSTHOG_PROJECT_TOKEN`·`POSTHOG_HOST`·`APP_VERSION`·`APP_ENVIRONMENT`를 번들에 박아넣는다. 런타임 설정이 아니므로 **값을 바꾸면 재빌드·재배포해야 한다.** 배포 빌드는 `MAP_PROVIDER_MODE`가 비어 있어도 항상 Naver 지도를 선택하며, Client ID가 없으면 데모 지도로 대체하지 않고 설정 오류를 표시한다. MSW는 기본적으로 배포에서 꺼져 있지만 API 개발용 dev fixture가 필요할 때만 `ENABLE_MSW=true`로 선택해 켤 수 있다. 운영에서는 이 값을 지정하지 않는다.

| 환경변수                | prod                           | dev                                |
| ----------------------- | ------------------------------ | ---------------------------------- |
| `API_BASE_URL`          | `https://api.jachwi-sunbae.kr` | `https://dev-api.jachwi-sunbae.kr` |
| `MAP_PROVIDER_MODE`     | `naver`                        | `naver`                            |
| `NAVER_MAP_CLIENT_ID`   | Naver Maps Client ID           | 같은 Naver Maps Application의 ID   |
| `POSTHOG_PROJECT_TOKEN` | PostHog 프로젝트 토큰          | 같은 PostHog 프로젝트 토큰         |
| `POSTHOG_HOST`          | `https://us.i.posthog.com`     | `https://us.i.posthog.com`         |
| `APP_VERSION`           | `package.json` 버전            | `package.json` 버전                |

값은 CodePipeline Commands 빌드 액션의 환경변수로 전달한다. Naver Maps Client ID와 PostHog 프로젝트 토큰은 브라우저 번들에 포함되는 공개 식별자이며 REST API 키나 Client Secret 등 비밀값을 넣지 않는다. Naver Maps Application에 `https://www.jachwi-sunbae.kr`과 `https://dev.jachwi-sunbae.kr`을 Web 서비스 URL로 등록한다.

dev와 prod는 같은 PostHog 프로젝트에 수집한다. `API_BASE_URL`이 운영 API이면 `environment=production`, 그 외에는 `environment=development`를 모든 이벤트의 공통 속성으로 등록한다. PostHog 인사이트·퍼널·세션 리플레이에는 반드시 이 속성 필터를 적용해 두 환경을 분리한다. 로컬 개발은 `.env.local`에 `POSTHOG_PROJECT_TOKEN`과 `POSTHOG_HOST`를 넣은 경우에만 수집한다. 세션 녹화에서는 환경과 무관하게 텍스트와 요소 속성을 마스킹한다.

공용 사용자 행동 대시보드는 [자취선배 사용자 행동 모니터링](https://us.posthog.com/project/579863/dashboard/2149589)이다. 운영 현황은 `environment = production`, dev 검증은 `environment = development`로 필터링한다. 대시보드에는 DAU, 핵심 기능 이벤트, 로그인·매물 등록 퍼널, 에러·레이지클릭 추이와 `세션별 로그인 → 매물 등록 퍼널`이 포함되어 있다.

퍼널에서 바로 단계를 선택할 수 있도록 매물 등록 단계는 다음 이벤트를 사용한다.

- `property_creation_started`
- `property_creation_deposit_completed`
- `property_creation_monthly_rent_completed`
- `property_creation_address_completed`
- `property_creation_name_completed`
- `property_creation_submitted`
- `property_created`

로그인 전환은 `login_page_viewed` → `login_started` → `login_succeeded` 순서로 확인하며, 실패는 `login_failed`로 별도 수집한다.

배포 번들은 `hidden-source-map`으로 source map을 생성한다. `publish.sh dev`와 `publish.sh prod`는 `POSTHOG_CLI_API_KEY`가 있으면 PostHog에 source map을 업로드한 뒤 S3에는 `.map` 파일을 올리지 않는다. 키가 없으면 업로드를 건너뛰고 `.map` 파일만 배포에서 제외한다.

```bash
export POSTHOG_CLI_API_KEY='<error_tracking:write 권한의 개인 API 키>'
export POSTHOG_CLI_PROJECT_ID='579863'
export POSTHOG_RELEASE_VERSION='1.1.1'
./frontend/deploy/upload-posthog-sourcemaps.sh
```

스크립트는 업로드가 끝난 뒤 `dist`의 source map을 삭제한다. API 키는 저장소나 브라우저 번들에 넣지 않는다.

`API_BASE_URL`이 비거나 올바른 HTTP(S) URL이 아니면 시작 시 예외가 발생한다. `MAP_PROVIDER_MODE=naver`에서 Naver Client ID가 비어도 같은 방식으로 실패한다. 잘못된 값으로 조용히 demo 지도를 제공하지 않는다.

## 캐시 무효화

운영 빌드는 파일명에 `contenthash`를 붙인다.

```
main.3ce7f01e0f4de40f8b0a.js
874.f084accee8510f4e798c.js
assets/jachwi-sunbae-logo.2e4dac46707736dbc407.png
```

내용이 바뀌면 파일명이 바뀌므로 브라우저가 캐시된 옛 파일을 쓰지 않는다. 따라서 배포마다 전체 무효화(`/*`)를 걸 필요가 없다.

**`index.html`만 무효화한다.** 이 파일은 이름이 고정이고 안에 해시가 붙은 파일명을 담고 있어, 이것만 새로 받으면 나머지는 자동으로 새 파일을 가리킨다.

`publish.sh`는 해시가 붙은 JS·CSS·이미지에 `Cache-Control: public,max-age=31536000,immutable`을 설정한다. 내용이 바뀌면 URL도 바뀌므로 1년 동안 다시 검증하지 않아도 이전 버전과 충돌하지 않는다. 반면 `index.html`은 `Cache-Control: no-cache,max-age=0,must-revalidate`로 올려 매번 최신 해시 파일명을 재검증한다.

개발 빌드에는 해시를 붙이지 않는다. 파일명이 매번 바뀌면 dev-server의 HMR이 불편하다.

## 배포 성공 판정

`aws cloudfront create-invalidation`이 성공한 것만으로 배포 성공을 판정하지 않는다. `publish.sh`는 다음 순서를 모두 통과해야 성공한다.

1. 빌드된 `dist/index.html`이 있는지 확인한다.
2. `index.html`을 제외한 정적 자산을 1년 장기 캐시로 `sync --delete`한다.
3. `index.html`을 재검증 캐시 정책으로 별도 업로드한다.
4. `/index.html` 무효화를 만들고 `invalidation-completed`까지 기다린다.
5. 서비스 URL에서 `index.html`을 다시 받는다.
6. 로컬 `dist/index.html`이 참조하는 모든 JS·CSS 파일명이 서비스 응답에도 있는지 비교한다.

옛 `index.html`이 응답하면 새 번들 파일명이 없으므로 Commands 액션이 실패한다. 검증만 다시 실행할 때는 다음 명령을 쓴다.

```bash
./frontend/deploy/verify-deployment.sh frontend/dist/index.html https://dev.jachwi-sunbae.kr/index.html
./frontend/deploy/verify-deployment.sh frontend/dist/index.html https://www.jachwi-sunbae.kr/index.html
```

## SPA 폴백

react-router의 클라이언트 라우팅을 쓴다. `/intro`, `/properties/1`, `/map` 같은 경로는 S3에 실제 객체가 없으므로, CloudFront에서 403·404 응답을 `/index.html`(상태 200)로 매핑해야 한다.

이게 없으면 소개 QR의 `/intro` 직접 진입과 매물·지도 화면 새로고침이 깨진다.

## CloudFront origin path

**origin path를 반드시 지정한다.** prod는 `/jachwi-sunbae/web`, dev는 `/jachwi-sunbae/web-dev`다.

버킷 `techcourse-project-2026`은 여러 팀이 공유하고, 같은 버킷의 `jachwi-sunbae/` 아래에 **비공개 사진 객체**도 있다. origin path를 비워 두면 CloudFront가 버킷 전체를 공개하게 되어 사진이 인증 없이 노출된다.

## 확인

```bash
curl -I https://www.jachwi-sunbae.kr
curl -I https://www.jachwi-sunbae.kr/properties
```

둘 다 200이어야 한다. 두 번째가 404면 SPA 폴백이 빠진 것이다. 이 확인은 접근 가능성과 SPA 폴백을 보는 smoke test이며, 이번 번들 여부는 `verify-deployment.sh`가 판정한다.

배포된 프론트엔드 제품 버전은 환경별 `version.json`에서 확인한다.

```bash
curl -fsS https://dev.jachwi-sunbae.kr/version.json
curl -fsS https://www.jachwi-sunbae.kr/version.json
```

응답의 버전은 저장소 루트 `VERSION`과 같아야 한다. `publish.sh`가 매 배포 때 이 파일을 생성하고, 배포 검증 단계에서 함께 확인한다.

## 실제 구성

| 항목            | 값                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------- |
| CloudFront 배포 | `E3LI41UZ24V9WD` (`d3ajy5jwv266im.cloudfront.net`)                                        |
| 요금제          | Pay as you go                                                                             |
| 원본            | `techcourse-project-2026.s3.ap-northeast-2.amazonaws.com`, 원본 경로 `/jachwi-sunbae/web` |
| 캐시 정책       | 관리형 `CachingOptimized`                                                                 |
| 파이프라인      | `jachwi-sunbae-web-line`                                                                  |

## apex 도메인은 서비스하지 않는다

`jachwi-sunbae.kr`을 그대로 입력한 사용자는 아무 곳에도 닿지 않는다. 가비아는 apex에 CNAME을 넣을 수 없다.

**가비아 웹 포워딩을 쓰면 안 된다.** 이 기능은 `@`뿐 아니라 `www`에도 가비아 포워딩 서버를 가리키는 A 레코드를 만든다. 한 호스트에 CNAME과 A는 공존할 수 없으므로 `www`의 CloudFront CNAME이 밀려나 **사이트 전체가 뜨지 않게 된다.**

AWS로 리다이렉트를 만들려면 리다이렉트 전용 S3 버킷과 CloudFront 배포, apex를 포함한 인증서가 더 필요하다. 지울 수 없는 리소스가 둘 늘어나므로 지금은 두지 않는다.

## JSX 런타임은 빌드 모드에 따라 갈린다

`webpack.config.js`에서 `@babel/preset-react`에 `development`를 **명시한다.**

```js
['@babel/preset-react', { runtime: 'automatic', development: !isProduction }],
```

명시하지 않으면 babel이 개발 모드로 판단해 `jsxDEV`를 내보낸다. webpack의 `--mode production`은 번들 안의 `NODE_ENV`만 바꾸고 빌드 프로세스의 `NODE_ENV`는 건드리지 않기 때문이다.

React 19의 운영 JSX 런타임에는 `jsxDEV`가 없다. 그래서 **빌드는 성공하고 브라우저에서만 터진다.**

```
Uncaught TypeError: (0 , u.jsxDEV) is not a function
```

빌드·타입·린트·테스트가 모두 통과하므로 CI로는 걸러지지 않는다. 운영 번들을 실제 브라우저에서 열어봐야 드러난다.

Storybook도 GitHub Pages에 정적 배포하므로 같은 규칙을 적용한다. `.storybook/main.ts`의 Babel React preset은 `development: false`로 고정해 `jsxDEV`를 생성하지 않는다. 이를 개발 모드로 바꾸면 Storybook 빌드는 성공해도 Pages에서 컴포넌트를 열 때 같은 오류가 재발할 수 있다.

## 빌드 환경의 Node 버전

파이프라인은 `.nvmrc`의 버전을 공식 tarball로 내려받아 **절대 경로로 실행한다.**

```bash
NODE_VERSION="$(tr -d '[:space:]' < frontend/.nvmrc | sed 's/^v//')"
...
PATH="/opt/node/bin:$PATH" /opt/node/bin/npm --prefix frontend run build
```

관리형 빌드 환경에는 Node 18이 이미 설치되어 있고 PATH에서 앞선다. `yum install nodejs`로 22를 설치해도 실행되는 것은 18이다. `@babel/core` 8은 ESM 전용이라 `require(esm)`을 지원하지 않는 Node 18에서는 빌드가 실패한다.

```
Error [ERR_REQUIRE_ESM]: require() of ES Module @babel/core/lib/index.js not supported
```

`export PATH`도 안전하지 않다. 빌드 명령이 줄 단위로 실행되므로 앞 줄의 `export`가 다음 줄까지 살아 있다고 가정하지 않는다. 같은 줄에 `PATH=`를 앞세우고 npm도 절대 경로로 부른다.

여러 줄에 걸친 `case`·`if`·`for` 구문도 쓰지 않는다. 줄마다 쪼개져 깨진다.
