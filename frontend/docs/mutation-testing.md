# 뮤테이션 테스트

테스트가 통과한다는 사실만으로는 코드가 틀렸을 때 그 테스트가 실패하는지 알 수 없습니다. 뮤테이션 테스트는 소스에 일부러 작은 버그(변이)를 넣고 테스트가 그것을 잡는지 확인합니다. 살아남은 변이는 테스트가 지켜보지 않는 동작입니다.

## 1. 대상과 제외

Stryker 설정은 `frontend/stryker.config.mjs`에 있습니다.

| 구분 | 경로                                   | 이유                                                                       |
| ---- | -------------------------------------- | -------------------------------------------------------------------------- |
| 대상 | `src/**/{api,lib,model,hooks}/**/*.ts` | 폼 검증, 지도 계산, 파서, 저장소, 훅처럼 UI와 무관한 기능 규칙이 있습니다. |
| 제외 | `src/**/dtos/**`, `*.d.ts`             | 요청·응답 형태만 선언해 변이가 동작을 바꾸지 않습니다.                     |
| 제외 | `*ErrorMessages.ts`, `*QueryKeys.ts`   | 문자열 상수라 변이가 전부 살아남지만 잡을 가치가 없습니다.                 |
| 제외 | `src/app/**`, `src/shared/ui/**`       | 앱 조립, 목 서버, 공용 UI는 통합·컴포넌트 테스트가 지킵니다.               |

UI 컴포넌트와 화면 통합 테스트는 대상에 넣지 않습니다. 변이 하나마다 jsdom과 화면을 다시 세워야 해서 느리고, UI 구조가 바뀌면 함께 바뀌는 테스트라 점수의 기준으로 삼기 어렵습니다.

변이체를 돌릴 때는 `frontend/vitest.stryker.config.mjs`를 씁니다. 기본 Vitest 설정을 그대로 쓰되 `test/**/{api,lib,model,hooks}`와 `test/pages/**/*.test.ts`만 포함합니다.

## 2. 실행 방법

```bash
# 바뀐 로직 파일에만 돌린다. 기준은 origin/develop이고 인자로 바꿀 수 있다.
npm run test:mutation:changed
npm run test:mutation:changed -- HEAD~3

# 대상 전체에 돌린다. 몇 분 걸리고 두 번째부터는 증분 결과를 재사용한다.
npm run test:mutation
```

결과는 터미널 요약과 `frontend/reports/mutation/index.html`에 남습니다. 증분 결과는 `frontend/reports/mutation/incremental.json`에 저장되며 둘 다 Git에서 제외합니다.

## 3. 결과를 읽는 법

- `Killed`: 테스트가 변이를 잡았습니다.
- `Survived`: 변이가 들어갔는데 모든 테스트가 통과했습니다. 그 동작을 검증하는 단언이 없다는 뜻입니다.
- `No coverage`: 그 줄을 실행하는 테스트가 없습니다.
- `Timeout`: 변이가 무한 루프 등을 만들어 시간 초과로 끝났습니다. 잡은 것으로 칩니다.

살아남은 변이를 전부 없애는 것이 목표가 아닙니다. 다음은 그대로 둡니다.

- 등가 변이: 바꿔도 동작이 같은 변이입니다. 예를 들어 `views.size > 20`을 `>= 20`으로 바꿔도 캐시 상한의 의미가 거의 같다면 테스트를 억지로 맞추지 않습니다.
- 표현 상수: 요일 배열, `Intl.NumberFormat` 옵션처럼 출력 형식만 바꾸는 변이는 화면에서 확인하는 편이 낫습니다.

반대로 다음은 반드시 테스트를 보강합니다.

- 조건 분기가 `true`나 `false`로 고정돼도 살아남는 경우: 그 분기의 양쪽을 검증하는 케이스가 없습니다.
- 경계 비교(`<`를 `<=`로)가 살아남는 경우: 경계값 입력이 없습니다.
- 산술 연산자나 정렬 비교가 살아남는 경우: 결과 값을 구체적으로 확인하지 않습니다.

점수를 팀 지표로 쓰지 않습니다. 점수를 목표로 삼으면 죽이기 쉬운 단언만 늘어납니다.

## 4. CI 동작

`frontend-ci.yml`의 `mutation` 잡은 PR에서 `src/**/{api,lib,model,hooks}` 아래 `.ts` 파일이 바뀐 경우에만 실행됩니다.

- 바뀐 파일만 대상으로 `scripts/mutation-changed.mjs`를 실행합니다.
- 결과 요약을 workflow summary에 적고, HTML 보고서를 artifact `mutation-report`로 올립니다.
- 증분 결과는 브랜치별로 캐시해 같은 PR의 다음 실행을 줄입니다.
- `continue-on-error`로 두어 병합을 막지 않습니다. 살아남은 변이는 리뷰에서 테스트 보강 여부를 정합니다.

## 5. 기준 측정

측정일 2026-10-18, 대상 전체에 `npm run test:mutation`을 실행한 결과입니다.

| 항목                              | 값                                    |
| --------------------------------- | ------------------------------------- |
| 대상 파일                         | 111개                                 |
| 변이 수                           | 8,642개                               |
| 잡음(Killed·Timeout)              | 3,422개                               |
| 살아남음(Survived)                | 1,496개                               |
| 실행하는 테스트 없음(No coverage) | 3,722개                               |
| 점수                              | 39.6%                                 |
| 테스트가 실행한 변이만의 점수     | 69.6%                                 |
| 실행 시간                         | 101분 (부하가 높은 로컬 장비, 7 워커) |

`No coverage`가 43%인 이유는 대상 파일 중 상당수가 로직 테스트 없이 화면 통합 테스트로만 보호되기 때문입니다. 예를 들어 `useNeighborhoodPreview.ts`(775개)와 `useNaverMap.ts`(351개)는 `NeighborhoodPreviewPage`와 `MapCanvas` 테스트가 실행하지만, 두 테스트는 뮤테이션 대상 테스트 집합에 들어 있지 않습니다. 이 목록은 "화면 테스트에만 의존하는 로직"을 찾는 용도로 쓰고, UI 개편 때 훅 단위 테스트로 옮길 후보로 봅니다.

살아남은 변이가 많았던 파일은 다음과 같습니다.

| 파일                                                            | 변이 | 살아남음 | 실행 없음 |  점수 |
| --------------------------------------------------------------- | ---: | -------: | --------: | ----: |
| `features/property/api/propertyParsers.ts`                      |  484 |      139 |       146 | 41.1% |
| `features/auth/api/apiClient.ts`                                |  391 |       90 |        37 | 67.5% |
| `pages/nearby-analysis/hooks/useNearbyAnalysis.ts`              |  140 |       68 |        36 | 25.7% |
| `pages/map/hooks/useMapSheet.ts`                                |  299 |       66 |       106 | 42.5% |
| `pages/map/hooks/useMapProperties.ts`                           |  120 |       65 |         4 | 42.5% |
| `features/property/lib/propertyForm.ts`                         |  171 |       64 |        16 | 53.2% |
| `features/map/lib/mapClustering.ts`                             |  163 |       58 |         6 | 60.7% |
| `pages/neighborhood-preview/model/neighborhoodSearchSession.ts` |  151 |       56 |         1 | 62.3% |
| `pages/map/hooks/useMapLocation.ts`                             |   96 |       52 |         7 | 38.5% |

보강 작업은 살아남은 변이가 많고 실제 수정 이력이 있는 파일부터 진행했습니다. 보강 전후 비교는 아래 표에 있습니다.

| 파일                                        | 변이 | 보강 전 살아남음 | 보강 전 점수 | 보강 후 살아남음 | 보강 후 점수 |
| ------------------------------------------- | ---: | ---------------: | -----------: | ---------------: | -----------: |
| `features/property/lib/propertyForm.ts`     |  171 |               64 |        53.2% |               21 |        87.1% |
| `features/map/lib/mapClustering.ts`         |  163 |               58 |        60.7% |               14 |        90.2% |
| `features/property/lib/propertyFormat.ts`   |   57 |               10 |        70.2% |                3 |        94.7% |
| `features/property/lib/visitSchedule.ts`    |   56 |               10 |        82.1% |                6 |        89.3% |
| `features/checklist/lib/checklist.ts`       |   52 |                5 |        90.4% |                1 |        98.1% |
| `features/checklist/lib/checklistEditor.ts` |   19 |                5 |        63.2% |                0 |       100.0% |
| `features/map/lib/mapViewportFocus.ts`      |   21 |               11 |        47.6% |                0 |       100.0% |
| `pages/map/lib/mapViewState.ts`             |   28 |                4 |        67.9% |                1 |        96.4% |
| 합계                                        |  567 |              167 |        64.2% |               46 |        91.4% |

보강 전 살아남은 변이 중 실제 버그 가능성이 있었던 예입니다.

- `propertyForm.ts`: 보증금·월세가 비어 있을 때와 숫자가 아닐 때의 안내 문구가 바뀌어도 테스트가 `expect.any(String)`만 확인해 통과했습니다. 이름 30자, 주소 255자, 확인한 곳 500자 경계도 초과 쪽만 검증했습니다.
- `mapClustering.ts`: 줌 레벨 4·5·6의 군집 반경(55m·110m·220m) 분기가 어느 쪽으로 바뀌어도 테스트가 알지 못했고, 경도 거리의 위도 보정과 군집 중심의 경도 평균을 검증하지 않았습니다.
- `mapViewportFocus.ts`: 메르카토르 변환의 산술 연산자 11개가 모두 살아남았습니다. 중심이 "남동쪽으로 움직인다"만 확인하고 값은 확인하지 않았기 때문입니다.
- `visitSchedule.ts`: 오늘 날짜의 일정을 "지난 일정"으로 읽어 다음 해로 넘기는 경계(`<` 대신 `<=`)와 요일 배열 7개 중 6개가 검증되지 않았습니다.

남은 생존 변이는 대부분 등가 변이이거나 방어 코드입니다. 예를 들어 `parseMoneyInput`의 `amount >= 0`은 앞선 숫자 정규식 때문에 항상 참이고, `toWon`의 상한 검사는 `parseMoneyInput`이 먼저 걸러서 도달하지 않습니다.
