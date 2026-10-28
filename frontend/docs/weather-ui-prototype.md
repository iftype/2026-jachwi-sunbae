# 생활 날씨 카드

마이 화면의 생활 날씨 카드와 알림 받기 토글이다. 아직 날씨·위치·알림 API와 앱 푸시를 연결하지 않아 샘플 데이터로 동작한다.

- 작업 이슈: [#447](https://github.com/woowacourse-teams/2026-jachwi-sunbae/issues/447) (시연 화면 [#441](https://github.com/woowacourse-teams/2026-jachwi-sunbae/issues/441)에서 이어짐)
- 기준: [#431](https://github.com/woowacourse-teams/2026-jachwi-sunbae/issues/431), [PR #432](https://github.com/woowacourse-teams/2026-jachwi-sunbae/pull/432)의 `fc812f9`, [제품 명세](../../docs/product/specs/weather.md)

## 실행

저장소에서 Node.js `frontend/.nvmrc` 버전을 사용한다. 새 환경변수 파일이나 백엔드 실행은 필요 없다.

```bash
cd frontend
npm ci
npm run dev:mock
```

[마이페이지](http://localhost:3000/me)를 연다. 기존 익명 인증은 기존 MSW가 처리한다.

## 동작

1. 마이에는 생활 날씨 카드, 개인정보 처리방침, 계정 삭제 요청만 둔다. 데스크탑·휴대폰 컴포넌트를 나누고, 흰 바탕에 회색 카드를 화면 폭을 따라 늘이지 않고 가운데에 둔다. 날씨 상세·알림 설정 화면은 두지 않는다.
2. 알림이 꺼져 있으면 날씨 대신 알림 꺼짐 아이콘과 안내를 보이고, 켜면 서울 시청(샘플 위치)의 현재 시각 예보와 오늘 최저·최고 기온을 보인다. 켜짐·꺼짐 모두 같은 높이를 유지하고 바뀌는 내용에 전환 효과를 준다.
3. **알림 받기**를 켜면 알림 권한 → 위치 권한 순서로 OS가 직접 묻는다. 웹은 별도 안내 창이나 토스트를 띄우지 않고 결과만 반영하며, 지금은 아직 묻지 않은 권한을 허용한 것으로 처리한다.
4. 받을 수 없는 상태는 토글 아래에 알린다. 기기 알림 또는 위치 권한 거부는 **설정 열기**를, 웹 브라우저 접속은 토글을 막고 앱 안내를 표시한다. 현재 위치를 찾지 못하면 마지막 저장 위치를 쓰고 `마지막 위치 기준`으로 표시한다. 이 상태들은 `WeatherPrototypeProvider`의 `initialState`로 테스트에서 재현한다.

## 미연결 기능

- `src/features/weather/model/weather.ts`는 현재 조회 응답 DTO를, `weatherFixtures.ts`는 `code/message/data` 형태의 샘플 예보를 담는다. 화면 상태는 `WeatherPrototypeProvider`의 메모리에만 둔다.
- 날씨 조회·위치 저장·수신 동의·기기 등록 API는 호출하지 않는다. 기상청·DB·Firebase·OS 권한·실제 알림 스케줄도 연결하지 않는다.
- 실제 연결 시 조회 DTO, 위치 저장, 수신 동의, 기기 등록, 앱 브리지(FCM 토큰·권한 결과·설정 열기)를 연결해야 한다. 실제 발송에는 수신 동의·저장 위치·등록 기기·발송 가능한 예보가 필요하다.
