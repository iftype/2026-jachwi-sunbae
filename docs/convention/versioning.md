# 버전 관리

## 기본 원칙

- 저장소 루트의 `VERSION`을 제품 버전의 단일 기준으로 사용한다.
- 백엔드, 프론트엔드, iOS, Android는 같은 제품 버전을 사용한다.
- 제품 버전은 `MAJOR.MINOR.PATCH` 형식의 시맨틱 버저닝을 따른다.
- 배포 전에 `python3 .github/scripts/check_versions.py`로 버전 동기화를 검사한다.
- 릴리스별 변경은 루트의 `CHANGELOG.md`에 기록한다.

## 버전 증가 기준

- `MAJOR`: 기존 API, 데이터 또는 핵심 사용자 흐름과 호환되지 않는 변경
- `MINOR`: 하위 호환되는 기능이나 지원 플랫폼 추가
- `PATCH`: 하위 호환되는 버그 수정, 성능 개선 또는 내부 리팩터링

현재 개발된 아키텍처·앱·성능 개선을 포함하는 초기 개발 기준 버전을 `0.0.0`으로 설정한다. 안정적인 공개 API와 운영 호환성을 보장하는 첫 릴리스에서 `1.0.0`으로 올리고, 이후부터는 변경 영향에 따라 다음 릴리스 버전을 결정한다.

## 변경 내역과 릴리스

- 기능 브랜치에서 발생한 변경은 릴리스 PR의 `CHANGELOG.md`에 `Unreleased` 또는 다음 릴리스 섹션으로 정리한다.
- 릴리스 PR에서 `VERSION`, 각 애플리케이션 버전, changelog 섹션을 함께 확정한다.
- `main`에 릴리스 PR이 반영되면 Release 워크플로가 `vMAJOR.MINOR.PATCH` Git 태그와 GitHub Release를 생성한다.
- 프론트엔드 배포 결과는 `/version.json`에서 확인하며, 백엔드 배포 결과는 `/actuator/info`의 `build.version`과 `build.commit`으로 확인한다.

### 릴리스 버전 변경 절차

`VERSION`을 수정해도 각 애플리케이션 버전이 자동으로 변경되지는 않는다. 릴리스 PR에서 다음 값을 같은 제품 버전으로 함께 수정한다.

| 파일                                                      | 변경할 값                                 |
| --------------------------------------------------------- | ----------------------------------------- |
| `VERSION`                                                 | 제품 버전                                 |
| `frontend/package.json`, `mobile/package.json`            | `version`                                 |
| `frontend/package-lock.json`, `mobile/package-lock.json`  | 최상위 `version`과 `packages[""].version` |
| `frontend/public/version.json`                            | `version`                                 |
| `backend/build.gradle`                                    | `version`                                 |
| `mobile/android/app/build.gradle`                         | `versionName`                             |
| `mobile/ios/JachwiSunbaeMobile.xcodeproj/project.pbxproj` | Debug·Release의 `MARKETING_VERSION`       |

lock 파일에서 외부 의존성의 버전은 변경하지 않는다. `CHANGELOG.md`에는 해당 버전의 릴리스 섹션과 변경 내역, 릴리스 링크를 추가하고 `Unreleased` 비교 링크의 기준 태그를 갱신한다.

저장소 루트에서 두 검사를 모두 통과해야 한다. 버전 검사에는 프론트엔드와 모바일 lock 파일의 제품 버전도 포함된다.

```bash
python3 .github/scripts/check_versions.py
python3 .github/scripts/check_changelog.py "$(tr -d '[:space:]' < VERSION)"
```

## 롤백 기준

1. 장애가 발생한 환경의 제품 버전과 커밋을 기록한다.
2. `CHANGELOG.md`와 GitHub Release에서 직전 정상 버전의 태그를 확인한다.
3. 해당 태그의 커밋 또는 CodePipeline의 직전 정상 실행을 같은 환경에 재배포한다.
4. 프론트엔드는 `/version.json`, 백엔드는 `/actuator/info`를 조회해 복구된 버전과 커밋을 확인한다.

운영 브랜치의 이력을 덮어쓰거나 태그를 이동하지 않는다. 잘못된 릴리스는 새 PATCH 버전으로 수정하고, 긴급 복구는 기존 태그를 기준으로 재배포한다.

## 네이티브 빌드 번호

iOS의 `CURRENT_PROJECT_VERSION`과 Android의 `versionCode`는 제품 버전과 별도로 관리하는 배포 빌드 번호다. 앱 스토어에 새 빌드를 업로드할 때마다 이전 값보다 크게 증가시킨다.

## 릴리스 태그

운영 릴리스가 `main`에 반영된 뒤 `vMAJOR.MINOR.PATCH` 형식으로 태그를 생성한다. 개발 브랜치나 `develop` 반영 시점에는 릴리스 태그를 만들지 않는다.
