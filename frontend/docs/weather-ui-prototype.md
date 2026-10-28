# 생활 날씨 카드

마이 화면의 생활 날씨 카드와 알림 받기 토글이다. 날씨 조회·알림 위치·수신 동의는 서버 API([PR #432](https://github.com/woowacourse-teams/2026-jachwi-sunbae/pull/432))를 쓰고, 앱 푸시 기기 등록은 아직 연결하지 않았다.

- 작업 이슈: [#447](https://github.com/woowacourse-teams/2026-jachwi-sunbae/issues/447) (시연 화면 [#441](https://github.com/woowacourse-teams/2026-jachwi-sunbae/issues/441)에서 이어짐)
- 명세: [생활 날씨](../../docs/product/specs/weather.md)

## 실행

```bash
cd frontend
npm ci
# 개발 서버 API로 확인
DEV_API_PROXY_TARGET=https://dev-api.jachwi-sunbae.kr npm run dev
# 서버 없이 MSW 목으로 확인
npm run dev:mock
```

[마이페이지](http://localhost:3000/me)를 연다. 위치는 브라우저(앱은 WebView)의 위치 권한으로 구한다.

## 동작

1. 마이에는 생활 날씨 카드, 개인정보 처리방침, 계정 삭제 요청만 둔다.
2. 알림이 꺼져 있으면 날씨 대신 알림 꺼짐 안내를 보이고, 켜져 있으면 현재 위치의 현재 시각 예보와 오늘 최저·최고 기온을 보인다. 위치 이름은 역지오코딩 결과의 구·동이다.
3. **알림 받기**를 켜면 현재 위치를 구해 `PUT /api/members/me/weather-location`으로 저장한 뒤 `PUT /api/members/me/weather-notification-settings`로 수신 동의를 켠다. 위치를 하나도 구하지 못하면 켜지 않는다.
4. 알림을 켜 둔 채 마이를 열 때마다 현재 위치를 다시 저장한다. 서버는 마지막으로 저장한 위치로 알림을 보낸다. 현재 위치를 못 잡으면 이 기기에 남긴 마지막 위치로 날씨를 보이고 `마지막 위치 기준`으로 표시한다.
5. 위치 권한 거부, 저장 실패, 웹 브라우저 접속(알림은 앱에서만 받음)은 토글 아래에 알린다. 앱 여부는 `window.__JACHWI_NATIVE_APP__` 또는 앱 User-Agent로 판단한다.

## 미연결 기능

- 앱 푸시 기기 등록(`PUT /api/members/me/weather-devices/current`)은 앱이 FCM 토큰·설치 ID를 브리지로 넘겨줘야 해서 아직 호출하지 않는다. 기기가 없으면 서버는 알림을 보내지 않는다.
- 기기 알림 권한 상태와 OS 설정 열기도 앱 브리지가 필요하다.
