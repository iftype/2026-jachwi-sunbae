# 랜딩 이야기 기계 그림 (실험)

랜딩의 "동네를 찾고, 본 방은 기록하고 비교해요"를 anatomy 스타일의 등각 기계 그림 한 장(`landing-anatomy.html`)으로 만든 실험이다. 랜딩에는 넣지 않았다.

## 실행

Node.js 20 이상과 이 노트북에 설치된 anatomy 스킬(`~/.claude/skills/anatomy`)이 필요하다. 다른 곳에 있으면 `ANATOMY_HOME`으로 알려준다. 외부 패키지는 쓰지 않는다.

```bash
node tools/landing-anatomy/build.mjs           # landing-anatomy.html을 다시 만든다
node tools/landing-anatomy/build.mjs --audit   # 겹침, 받침, 그리는 순서 점검
```

브라우저에서 `landing-anatomy.html`을 연다. 테마는 시스템 설정을 따르고, `#light`나 `#dark`를 주소 끝에 붙이면 고정된다. 글꼴(Pretendard)은 CDN에서 불러온다.

## 조작

| 입력                  | 동작                                           |
| --------------------- | ---------------------------------------------- |
| 좌우로 끌기, ← →      | 통근 시간 다이얼(10~90분, 5분 단위)            |
| 환승 스위치 클릭, T   | 환승 0, 1, 2회까지                             |
| 월세 레일 클릭, R     | 월세 상한 45~70만원, 상한 없음                 |
| 칠해진 칸 클릭, Space | 본 방 기록(노란 핀과 카드), 다시 누르면 빼기   |
| Esc                   | 기록 비우기                                    |

## 파일

| 파일                   | 내용                                                        |
| ---------------------- | ----------------------------------------------------------- |
| `model.mjs`            | 동네 판, 노선, 통근 시간 계산(순수 모듈). 숫자는 모두 여기 |
| `build.mjs`            | 부품 배치와 SVG, 페이지 조립, `--audit` 점검                |
| `live.js`              | 페이지 안 움직임과 입력                                     |
| `landing-anatomy.css`  | 브랜드 색(파랑, 노랑)과 비교표 스타일                       |
| `preview/`             | 라이트, 다크 미리보기 PNG                                   |
| `REPORT.md`            | 실험 결과 보고                                              |

## 스크린샷 다시 찍기

`tools/landing-motion`의 Playwright Chromium을 쓴다.

```bash
(cd tools/landing-motion && npm install && npm run setup)
export CHROME_PATH=$(ls -d ~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome | tail -1)
S=~/.claude/skills/anatomy/scripts
node $S/capture.mjs tools/landing-anatomy/landing-anatomy.html --out tools/landing-anatomy/preview/light.png --theme light --reduced
node $S/capture.mjs tools/landing-anatomy/landing-anatomy.html --out tools/landing-anatomy/preview/dark.png --theme dark --reduced
node $S/lines.mjs tools/landing-anatomy/landing-anatomy.html --reduced
```
