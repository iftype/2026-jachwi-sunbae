# 랜딩·월세·목적지 서칭 측정 기준

## 목적과 적용 순서

월세 조회는 관심 지역의 실제 거래 목록 확인까지, 목적지 서칭은 조건에 맞는 동네를 고르고 대중교통 경로 확인까지 측정한다. 클릭 의도와 실제 결과 표시를 구분한다.

`feat/343-exploration-analytics`는 2026-10-14의 `origin/develop`에서 분기했다. 기존 PostHog 작업 이슈 #343의 후속 분석 준비이며, 수집 책임을 분리한 기존 변경(#344)을 그대로 사용한다. SDK·백엔드 API·로그인 정책은 변경하지 않는다.

선행 작업은 `feat/319-landing-neighborhood-preview`이다. 이 브랜치가 병합된 후 분석 브랜치를 최신 develop 위로 rebase하고, 충돌 시 새 공개 탐색 UI·라우팅·검색 복원 기능을 유지하면서 아래 로그 호출을 합친다. 아직 진행 중인 랜딩 작업본의 복사본에 분석 코드를 적용하여 통합 검사했다. 원래 작업본에는 수정하지 않았다.

- `useNeighborhoodPreview`: 실제 검색 실행·재시도·동네 선택·정류장 변경에 분석 호출을 유지한다. 검색 응답 결과는 `useNeighborhoodAnalytics`에서 한 번 수집한다.
- `NeighborhoodPricePage` / `NeighborhoodRoutePage`: `useNeighborhoodDetailAnalytics` 호출을 유지한다. 기존 공개 경로와 동적 `mapPath`를 보존한다.
- 새 `LandingPage`: 기존 방문 `useEffect`를 `useLandingAnalytics('exploration_v1')`로 교체한다. 둘 다 실행하면 방문 로그가 중복된다. 기존 화면은 `instagram_v1`이다.
- 새 `LandingDemo`: 사용자의 단계·모드·재생 버튼 조작만 `trackLandingDemoInteraction`으로 측정한다. 자동 애니메이션은 실제 검색·등록 이벤트로 보내지 않는다.

마지막 두 항목의 변경은 [랜딩 병합 후 적용 패치](exploration-landing-after-merge.patch)로 준비했다. 기준 파일은 2026-10-14의 진행 중 랜딩 작업본이다. 후속 수정으로 문맥이 달라지면 내용을 확인해 반영한다. 선행 브랜치가 병합된 상태에서 저장소 루트에서 `git apply --check frontend/docs/exploration-landing-after-merge.patch`로 먼저 검사한다. 이 패치는 로그 모듈을 설치하는 패치가 아니므로 분석 브랜치의 신규 모듈도 함께 필요하다.

## 공통 집계 기준

기본은 최근 14일, `environment=production`, 내부·테스트 코호트 `520731` 제외다. 익명 사용자와 로그인 사용자를 포함한다. 광고 여부는 제한하지 않는다. 로그인 식별 병합은 기존 SDK 구현을 이용한다.

고유 사용자 수는 선택 기간 전체에서 중복 제거한다. 일별 DAU를 더하거나 사용자 수와 세션 수를 나누지 않는다. 동일 사용자가 웹과 앱 모두 사용하면 플랫폼별 수치를 단순 합산하지 않는다. 개발 검증은 대시보드 환경 필터를 development로 바꾸며 mock 응답을 확인하려면 해당 시리즈의 `mock_data=false` 필터도 해제해야 한다.

## 이벤트 계약

모든 이벤트는 기존 수집 계층에서 `environment`, `platform`, `app_version`을 부여한다. 기능 이벤트에는 `feature=rental/commute`, `entrypoint=public_explore/neighborhoods`, `mock_data`를 추가한다.

| 이벤트                               | 발생 시점                              | 주요 추가 속성                                                         |
| ------------------------------------ | -------------------------------------- | ---------------------------------------------------------------------- |
| `landing_page_viewed`                | 랜딩 진입, StrictMode 중복 제외        | `landing_variant`                                                      |
| `service_introduction_viewed`        | /about 서비스 소개 진입                | `landing_variant`                                                      |
| `landing_cta_clicked`                | 실제 시작·스토어 이동 버튼 클릭        | `destination=web/app_store/google_play`, `placement`, `page_kind`      |
| `landing_demo_interacted`            | 시연의 단계·모드·재생 버튼 직접 조작   | `action`, 미리 정한 `value`                                            |
| `neighborhood_feature_viewed`        | 해당 모드의 지도 진입                  | 공통 기능 속성                                                         |
| `neighborhood_search_submitted`      | 유효한 목적지·조건으로 동네 조회 실행  | `search_id`, `trigger=search/retry`, 통근 조건 또는 월세 필터          |
| `neighborhood_search_results_viewed` | 조회가 끝나 결과/빈 결과를 표시        | `search_id`, `result_count`, `has_results`, 월세는 `transaction_count` |
| `neighborhood_search_failed`         | 검색 요청/경계 조회 실패가 화면에 표시 | `search_id`, `error_kind=request`                                      |
| `neighborhood_area_selected`         | 실제 조회 결과에 있는 동네 선택        | `search_id`(현재 탭에서 검색한 경우)                                   |
| `rental_information_viewed`          | 선택한 동네의 월세 상세 목록 표시      | `transaction_count`, `has_transactions`                                |
| `commute_route_viewed`               | 경로 상세 화면에서 유효한 경로 표시    | 공통 기능 속성                                                         |
| `commute_route_failed`               | 경로 상세 화면에서 조회 실패 표시      | 공통 기능 속성                                                         |
| `commute_departure_station_changed`  | 다른 유효한 출발 정류장 직접 선택      | `search_id`(있는 경우)                                                 |

통근 검색에는 `max_minutes`, `max_transfers`를, 월세 검색에는 `max_rent_manwon`을 수집한다. 주소·목적지 이름·좌표·검색어·정류장 ID·거래 금액 원문을 새 로그에 보내지 않는다. 상세 중복 방지에 사용한 지역/정류장 키는 로컬 비교용이며 전송하지 않는다.

검색 요청은 재시도마다 별도 ID를 만들고 결과는 시도당 한 번만 기록한다. 취소·자동 refetch·StrictMode로 결과 건수를 늘리지 않는다. 검색 복원으로 목록을 다시 연 것은 상세 확인으로 기록할 수 있지만 새 검색으로 꾸미지 않는다. 공개 탐색의 기존 `exploration_completed`는 지도 검색 결과 표시이며 월세·통근 서비스 사용 완료가 아니다.

## 대시보드 지표

[랜딩·월세·통근 탐색 대시보드](https://us.posthog.com/project/579863/dashboard/2210224)에 14개 지표와 배포 대기 안내를 저장했다. [원격 카드 ID와 정의 기록](exploration-analytics-dashboard.json)은 배포 설정이 아니라 측정 계약 기록이다.

| 지표                          | 분자                              | 분모·단위                  |
| ----------------------------- | --------------------------------- | -------------------------- |
| 전체 방문자                   | `$pageview` 사용자                | 기간 고유 사용자           |
| 월세 정보 확인율              | 거래가 있는 월세 목록 확인 사용자 | 월세 모드 지도 방문 사용자 |
| 전체 방문자 중 월세 확인 비율 | 거래가 있는 월세 목록 확인 사용자 | 전체 방문 사용자           |
| 목적지 서칭 완료율            | 경로를 실제 확인한 사용자         | 통근 모드 지도 방문 사용자 |
| 출발 정류장 변경률            | 다른 정류장을 직접 선택한 사용자  | 경로를 확인한 사용자       |
| 결과 없음 비율                | 통근 검색의 빈 결과 건수          | 결과 표시+검색 실패 건수   |
| 검색 조건 분포                | 검색 실행 건수                    | 통근 시간·환승 횟수별 건수 |
| 랜딩 클릭률                   | 랜딩에서 시작 버튼을 누른 사용자  | 랜딩 방문 사용자           |

기간 사용자 비율과 순차 퍼널은 다르다. 두 기능의 퍼널은 **지도 진입 → 검색 실행 → 동네 선택 → 정보 표시**이며 고유 사용자·ordered·1시간 전환 창으로 구성했다. 같은 검색 시도만 연결하는 엄격한 퍼널은 아니며 사용자가 한 시간 안에 재검색한 경우 다른 시도의 단계가 이어질 수 있다.

월세는 `has_transactions=true`만 완료로 계산하고 빈 목록은 별도 카드로 본다. 통근 경로를 동네 선택 직후 미리 불러오는 것은 완료가 아니다. 화면 진입이나 API 실패만으로 `commute_route_viewed`를 보내지 않는다. 정류장 기본 자동 선택·같은 정류장 재클릭도 변경으로 세지 않는다.

결과 없음 비율은 응답이 끝난 시도 기준이다. 진행 중·취소된 시도를 실패나 빈 결과로 취급하지 않는다. 통근 검색 조건 분포는 사용자 비율이 아니라 검색 건수이므로 반복 사용자 영향이 있다. 기능별 사용자와 여러 스토어 이동 사용자도 서로 겹칠 수 있다.

랜딩 클릭률은 신규 `page_kind=landing`을 분자에 적용한다. 과거 CTA에는 이 속성이 없으므로 새 로그 배포 전후 기간을 섞지 않는다. 스토어 클릭을 설치·앱 진입 성공으로 해석하지 않는다.

## 검증과 배포 후 확인

2026-10-14에 신규 계약용 14개 원격 쿼리를 재계산했고 실행 오류는 없었다. 신규 이벤트는 당시 수집 목록에 없었다. 따라서 신규 카드의 0%·빈 차트는 미수집 상태이며 성과 판정이 아니다. 지표 목표 수치는 팀에서 기준선과 실사용 피드백을 확보한 뒤 정한다.

자동 검사에는 검색 성공·빈 결과·실패·재시도·취소, StrictMode 중복, 캐시 재렌더, 실제 월세 목록 표시, 경로 프리패치와 표시 구분, 정류장 변경을 포함한다. 코드 검사 통과와 PostHog 실제 수신 확인은 별개다.

준비 브랜치 전체 75개 파일·395개 테스트와 운영 빌드가 통과했다. 상세 직접 진입을 분모에 포함하는 후속 변경은 관련 13개 테스트·타입 검사로 확인했다. 선행 랜딩의 작업본 복사본에 합친 통합본은 관련 40개 테스트·린트·타입 검사·운영 빌드가 통과했다. 통합 빌드에서 디스크 공간 부족으로 Webpack 캐시 저장 경고가 있었으나 번들 생성은 성공했다.

1. 선행 랜딩 병합 후 통합본으로 린트·포맷·타입·테스트·빌드를 다시 검사한다.
2. dev 배포 후 익명 랜딩 → 공개 월세/통근 → 목적지 선택 → 검색 → 동네 선택 → 목록/경로 표시를 진행하고 해당 버전의 이벤트를 대조한다.
3. 빈 거래 목록·빈 동네 결과·검색 실패·경로 실패·재시도·정류장 변경도 확인한다.
4. 웹·iOS WebView·Android WebView에서 공통 플랫폼·환경·버전 속성과 이벤트 누락 여부를 확인한다.
5. 운영 배포 후 동일 계약으로 수신을 확인하고 대시보드 날짜를 수집 시작 이후로 설정한다.

PR·배포는 아직 진행하지 않았다.
