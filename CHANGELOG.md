# 변경 내역

이 문서는 제품 릴리스별 사용자 영향과 주요 변경을 기록한다.

## [Unreleased]

아직 릴리스하지 않은 변경을 기록한다.

## [1.1.0] - 2026-10-07

### Added

- 모바일 광고용 랜딩 페이지를 추가한다.
- Playwright 기반 QA 시나리오 실행, 증거 수집, AI 분석과 결과 보고서를 추가한다.

### Changed

- dev·prod 배포 시 Vault에서 환경변수를 조회해 `app.env`를 갱신하고 AMI와 환경 설정을 분리한다.
- 배포 문서에 환경별 파이프라인, 요청 경로와 Vault 적용 흐름을 정리한다.
- 백엔드·프론트엔드·iOS·Android 제품 버전을 `1.1.0`으로 맞춘다.

### Fixed

- 매물 입력 경계값을 백엔드 기준으로 검증한다.
- 모바일 매물 등록 입력 흐름을 키패드 중심으로 개선한다.

### Performance

- WebView 지도 마커와 화면 렌더링을 개선한다.

## [1.0.0] - 2026-10-01

### Added

- iOS 네이티브 탭바를 추가하고 웹 화면의 라우트와 선택 탭을 동기화한다.
- 활성 사용자 분석 이벤트와 공용 컴포넌트 Storybook을 추가한다.

### Changed

- 매물 등록과 체크리스트 입력에 공용 플로팅 라벨을 적용한다.
- 체크리스트 서비스의 책임을 분리하고 백엔드 예외 계층과 오류 응답 처리를 정리한다.
- 백엔드·프론트엔드·iOS·Android 제품 버전을 첫 메이저 릴리스인 `1.0.0`으로 맞춘다.

### Fixed

- 터치 스크롤 시 하단바 이동과 지도 반경 기준 위치를 바로잡는다.
- 체크리스트 응답 계약에 맞게 프론트엔드의 항목 파싱을 수정한다.
- 모바일 패키지 lock 파일의 제품 버전을 동기화하고 CI 버전 검사에 포함한다.

## [0.0.1] - 2026-09-30

### Added

- 로그인과 매물 등록 사용자 행동 퍼널의 세부 이벤트를 수집한다.
- Dev와 Prod 배포에서 PostHog Error Tracking 소스맵을 업로드한다.

## [0.0.0] - 2026-09-29

### Added

- FSD Lite 기반 프론트엔드 아키텍처를 도입한다.
- React Native WebView 기반 iOS·Android 앱 셸을 추가한다.
- 제품 버전을 백엔드·프론트엔드·iOS·Android에 동기화하고 CI에서 검증한다.

### Changed

- 앱 환경에서 웹 분석 SDK가 실행되지 않도록 분리한다.
- 개인정보·모바일 실행·배포 문서를 보강한다.

### Performance

- WebView 지도 마커 위치 갱신을 `transform` 기반으로 최적화한다.
- 매물 사진 Object URL을 재사용해 지도 확대·이동 중 불필요한 재생성을 줄인다.

[Unreleased]: https://github.com/woowacourse-teams/2026-jachwi-sunbae/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/woowacourse-teams/2026-jachwi-sunbae/releases/tag/v1.1.0
[1.0.0]: https://github.com/woowacourse-teams/2026-jachwi-sunbae/releases/tag/v1.0.0
[0.0.1]: https://github.com/woowacourse-teams/2026-jachwi-sunbae/releases/tag/v0.0.1
[0.0.0]: https://github.com/woowacourse-teams/2026-jachwi-sunbae/releases/tag/v0.0.0
