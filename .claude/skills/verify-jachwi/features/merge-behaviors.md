# 머지로 생기는 동작

develop에 열린 PR #793(로딩 성능 모음), #794(effect 정리 모음), #808(로딩 표시 지연과 겹친 effect 정리)이 머지되면 생기는 동작의 확인 레시피다. #808 브랜치는 #793과 #794를 이미 품고 있다. 상태: 검증됨(2026-11-25, 이 통합 브랜치 `ff92db27`에 #808 머리 `29a22e76`을 합친 미리보기 빌드, 데스크탑 1440x900과 iPhone(WebKit)). 머지 뒤 develop에서 다시 돌려 상태를 고친다.

## 미리보기 빌드

```sh
git worktree add --detach "$TMPDIR/merged" <통합 브랜치 머리>
git -C "$TMPDIR/merged" merge --no-edit <#808 머리>
# frontend/node_modules 는 같은 package-lock 이면 링크로 쓴다. .env.local 은 복사(커밋 금지).
API_BASE_URL=http://localhost:4321 NODE_OPTIONS=--max-old-space-size=1024 \
  npx webpack --config webpack/webpack.config.cjs --mode production --no-devtool --no-optimization-minimize --no-performance-hints
node .claude/skills/verify-jachwi/scripts/serve.mjs --dist "$TMPDIR/merged/frontend/dist" --port 4321 --api mock --delay <ms>
```

- 압축(minify)과 소스맵을 끈 운영 모드 빌드다. 이 노트북은 여유 메모리가 1.4GB쯤이라 압축을 켜면 webpack이 커널에 죽는다(1.4GB). 동작 확인에는 영향이 없고, 크기나 속도 숫자에는 쓰지 않는다.
- 첫 매물 카드 이벤트를 볼 때만 `POSTHOG_PROJECT_TOKEN=phc_local_verify POSTHOG_HOST=http://localhost:4499`를 더해 빌드한다. 4499에는 서버가 없고 Playwright `route`가 받아 적는다. 실제 PostHog로는 아무것도 가지 않는다.

## 로딩 표시 지연

규칙: 0.3초 안에 끝나는 요청은 로딩 표시를 그리지 않고, 0.3초를 넘으면 그리며, 한 번 그린 표시는 250ms 남긴다(`shared/lib/hooks/useDelayedLoading.ts`).

- 재는 법: `serve.mjs --delay`를 150, 400, 1200으로 바꿔 가며 띄운다. 페이지 안에서 `MutationObserver`로 로딩 요소가 붙고 떨어진 시각을, `PerformanceObserver`(resource)로 그 요청의 시작과 끝을 `performance.now()` 하나의 시계로 적는다.
- `DelayedFallback`(매물 상세 메모 칸, 로딩 요소 `매물 메모를 불러오는 중이에요.`, 요청 `GET /api/properties/10/memo`). `/properties/10`을 바로 연다.

  | 응답 지연 | 데스크탑: 표시 시작 / 보인 시간 | iPhone: 표시 시작 / 보인 시간 | 판정             |
  | --------- | ------------------------------- | ----------------------------- | ---------------- |
  | 150ms     | 표시 없음                       | 표시 없음                     | 통과             |
  | 400ms     | 299ms / 253ms                   | 214ms / 312ms                 | 통과(250ms 남김) |
  | 1200ms    | 300ms / 955ms                   | 218ms / 1085ms                | 통과             |

  iPhone의 표시 시작은 WebKit이 요청 시작을 일찍 찍어(대기열 포함) 짧게 나온다. 표시는 요청을 만든 뒤 0.3초에 뜬다.

- `QueryState`의 `delayLoading`(데스크탑 매물 상세 옆 칸, 뼈대 `매물 상세를 불러오는 중이에요.`, 요청 `GET /api/properties/10`). 홈 리스트의 `신림역 원룸` 링크를 누른다.

  | 응답 지연 | 표시 시작 / 보인 시간 | 판정                  |
  | --------- | --------------------- | --------------------- |
  | 150ms     | 표시 없음             | 통과                  |
  | 400ms     | 293ms / 126ms         | 250ms를 남기지 않는다 |
  | 1200ms    | 295ms / 932ms         | 통과                  |

  `QueryState`는 응답이 오면 남김 시간과 상관없이 바로 내용을 그린다(`if (query.isPending)`에서만 표시를 본다). 문서(`delayLoading` 설명)는 "빠른 응답에는 뼈대 없이"만 약속하고 250ms 남김은 약속하지 않는다. `DelayedFallback`과 다르게 움직이므로 같게 할지는 #808 쪽에서 정한다. 이 지도는 지금 동작을 적어 둔다.

## 첫 매물 카드 시간 PostHog 전송

홈(`/`)을 처음 열고 첫 매물 사진 마커(`img[data-listing-thumbnail]`)가 그려지면 `first_listing_card_visible`을 한 번 보낸다(`shared/lib/analytics/posthog/firstListingCard.ts`). 화면에는 보이지 않는 부수 효과라 네트워크로 본다.

- 재는 법: 위 PostHog 빌드를 열고 `http://localhost:4499/**`를 Playwright `route`로 받아 POST 본문(`/e/`, `compression=base64`면 `data=` 뒤 base64)을 푼다. 12초 기다린 뒤 다른 주소로 옮겨 남은 이벤트를 보낸다.
- 결과: 데스크탑과 iPhone 모두 `/e/`로 `first_listing_card_visible` 한 건.

  | 기기              | time_ms | screen_route | visit_type | 회선 정보                                                |
  | ----------------- | ------- | ------------ | ---------- | -------------------------------------------------------- |
  | 데스크탑 Chromium | 1326    | `/`          | `first`    | `4g`, downlink 9.4, rtt 0                                |
  | iPhone WebKit     | 1340    | `/`          | `first`    | 모두 null(Safari는 Network Information API가 없다, 의도) |

- 함정: posthog-js는 자동화 브라우저를 봇으로 보고 이벤트를 버린다(사용자 에이전트의 `HeadlessChrome`, `navigator.webdriver`, `navigator.userAgentData.brands`). 그대로 돌리면 `/flags`만 가고 `/e/`가 0건이라 "안 보낸다"로 잘못 읽는다. SDK는 건드리지 않고 브라우저 쪽만 맞춘다: Chromium은 `--disable-blink-features=AutomationControlled`와 보통 Chrome 사용자 에이전트, 두 엔진 모두 init 스크립트로 `navigator.webdriver`를 false, `userAgentData`를 없앤다.

## 마커 템플릿 렌더

#806이 지도 마커를 서버 렌더러 없이 템플릿에서 DOM으로 만든다. 모양과 이름이 같아야 한다.

- 재는 법: 홈 `본 방 기록 지도`의 마커 버튼마다 이름(aria-label), 글자, `strong`, 사진 유무를 머지 전(통합 브랜치)과 미리보기에서 견주고, 같은 시각 스크린샷을 나란히 본다(실제 네이버 지도).
- 결과: 데스크탑과 iPhone 모두 `망원동 투룸`(75만), `신림역 원룸`(55만) 두 마커의 이름, 글자, 사진이 같다. 신림역 원룸 마커만 HTML이 26자 길다. 첫 매물 카드 계측용 `data-listing-thumbnail` 속성이다. 나란히 놓은 스크린샷에서 다른 곳을 찾지 못했다. 우리 출처 콘솔 오류와 실패한 요청 0.

## Esc로 닫기

`useEscapeKey`를 쓰는 곳 6곳이다. 데스크탑에서 연 뒤 Esc를 누른다. 휴대폰은 Esc 키가 없어 돌리지 않는다.

| 곳                                                 | 여는 법                                                          | Esc 뒤                                           | 판정      |
| -------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------ | --------- |
| 지도 첫 방문 안내(`useMapTip`)                     | 새 브라우저로 홈. `지도를 눌러 메모를 남기거나 본 방을 기록해요` | `확인` 사라짐                                    | 통과      |
| 기록 카드 메뉴(`RecordCardMenu`)                   | 홈 리스트 `신림역 원룸 메뉴`                                     | `신림역 원룸 삭제` 사라짐                        | 통과      |
| 사진 크게 보기(`PropertyPhotoViewer`)              | 매물 상세 `사진 크게 보기`                                       | 대화상자 닫힘                                    | 통과      |
| 본 방 기록 지도 위치 고르기(`RecordsMapProvider`)  | 데스크탑 매물 상세 `주소 ..., 수정`, `지도에서 고르기`           | `지도를 눌러 새 위치를 고르세요.` 사라짐         | 통과      |
| 동네 찾기 지도에서 선택(`NeighborhoodPreviewPage`) | `동네 찾기`의 `지도에서 선택`                                    | `선택 취소`(눌림)가 `지도에서 선택`(안 눌림)으로 | 통과      |
| 툴팁(`shared/ui/tooltip/Tooltip`)                  | 앱 화면에서 쓰는 곳이 없다(스토리만)                             | 검증 못 함                                       | 화면 없음 |

## /export와 /tips

통합 브랜치는 들어오는 링크가 없는 준비 중 화면 `/export`, `/tips`를 지웠고(`cc4d8cfa`), #808 브랜치에는 아직 있다. 합치면 지운 쪽이 남는다.

- 결과: 미리보기에서 데스크탑과 iPhone 모두 두 주소가 제목 `페이지를 찾을 수 없어요`를 보인다. 주소는 바뀌지 않는다. 우리 출처 오류 0.
