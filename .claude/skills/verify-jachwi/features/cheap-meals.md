# 저렴한 한 끼

기준 위치 근처 착한가격업소(식당), 편의점 행사상품, 배달 할인을 탭으로 보는 화면(`/cheap-meals/:mealTab?`)이다. 상태: 검증됨(2026-11-25, 데스크탑 1440x900과 iPhone(WebKit), 세 탭 목록).

## Sub-features

- `meals-restaurant` 탭 `식당`(`/cheap-meals/restaurant`, 기본). 지도와 `가게 목록`, 제목 `착한가격 가게 <N>곳`. `GET /api/maps/good-price-stores?latitude&longitude&radius`(반경 500, 1000, 2000).
- `meals-convenience` 탭 `편의점`(`/cheap-meals/convenience`). `편의점 브랜드`(이마트24, 세븐일레븐), `행사 유형`, `가격 정렬`, `행사상품 목록`. `GET /api/promotions?brand=`.
- `meals-delivery` 탭 `배달`(`/cheap-meals/delivery`). `배달 플랫폼`, `배달 혜택 목록`. `GET /api/delivery-discount-offers`.

## How to get to it (user POV)

- 데스크탑: 왼쪽 `화면 이동`의 `저렴한 한 끼`.
- 휴대폰: 하단 탭 `마이`의 바로가기 `저렴한 한 끼`.

## 목 응답

`frontend/src/app/mocks/handlers/mealHandlers.ts`다. 식당은 기준 위치 옆에 가게 둘(`선배네 김밥`, `골목 칼국수`), 편의점은 이마트24 둘과 세븐일레븐 하나, 배달은 둘(`선배 치킨`, `골목 떡볶이`)이다. 상품 이미지는 바깥 출처를 부르지 않도록 비워 두어 화면에는 `이미지 없음`이 나온다. `frontend/test/app/mocks/handlers.test.ts`가 세 응답이 앱의 응답 해석을 통과하는지 고정한다.

## 데스크탑과 iPhone(WebKit) 경로

- 실행(`qa`): `npm run test:iphone -- --device all cheap-meals`. 코드는 `qa/tests/desktop/cheap-meals.spec.ts`, `qa/tests/iphone/cheap-meals.spec.ts`. 위치 권한을 주고 현재 위치(37.5559, 126.9105)를 준다.
- 경로:
  1. 위 진입점으로 들어가면 주소가 `/cheap-meals/restaurant`이고, 현재 위치 기준 `good-price-stores`가 200이다. `가게 목록`에 `선배네 김밥 상세 보기`가 있고 제목이 `착한가격 가게 2곳`이다.
  2. 탭 `편의점`을 누르면 주소가 `/cheap-meals/convenience`, `promotions?brand=EMART24`가 200이고 `행사상품 목록`에 `참치마요 삼각김밥 상세 보기`가 있다.
  3. 탭 `배달`을 누르면 주소가 `/cheap-meals/delivery`, `delivery-discount-offers`가 200이고 `배달 혜택 목록`에 `배달 선배 치킨 할인 상세 보기`가 있다.
- 경로 끝에 우리 출처의 콘솔 오류와 실패한 요청이 0인지 본다. 스크린샷은 `qa/runs/<desktop|iphone>/shots/cheap-meals.png`다.

## Gotchas

- 처음에는 첫 매물 자리로 가게를 찾다가, 현재 위치를 받으면 그 자리로 다시 찾으며 앞 요청을 취소한다. 의도한 동작이라 경로는 그 취소만 판정에서 뺀다(`expectedProblems`).
- 위치 권한이 없으면 첫 매물 자리가 기준이다. 매물이 없으면 기준 위치가 없어 가게를 찾지 않는다.
- 목은 반경이 500, 1000, 2000이 아니면 400이다. 실제 서버와 같다.
