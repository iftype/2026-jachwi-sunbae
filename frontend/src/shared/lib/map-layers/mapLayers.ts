/**
 * 휴대폰 지도 화면의 층 순서(z-index). 클수록 위에 그린다.
 *
 * 시트에 붙어 함께 오르내리는 버튼 줄(`BottomSheet`의 `floating`: 현재 위치, 출퇴근 장소 다시 선택)은 지도 위 카드
 * (머리 줄, 찜 토글, 시설 분류 카드)보다 아래에 둔다. 시트를 끌어 올려 버튼이 카드 높이에 닿으면 카드 밑으로 깔리고 누르기도 카드가 받는다.
 * 시트 자체는 카드 이상이라 크게 열면 카드를 덮는다(같은 값이면 화면에서 나중에 그리는 시트가 위다). 화면 전체로 연 시트가 맨 위다.
 */
export const MAP_LAYER = {
  sheetFloating: 30,
  header: 31,
  bookmarkToggle: 32,
  categoryRail: 35,
  sheet: 35,
  fullPageSheet: 50,
} as const;
