/**
 * 휴대폰 지도 오른쪽 컨트롤 열(찜 토글, 시설 분류 카드)의 위쪽 시작 위치와 간격.
 * 확대 축소 버튼을 없앴으므로 지도 머리 줄 바로 아래에서 시작한다. 내 기록과 동네 찾기가 함께 쓴다.
 */
export const MOBILE_MAP_CONTROLS_TOP = 'calc(max(0.85rem, env(safe-area-inset-top)) + 8rem)';
export const MOBILE_MAP_CONTROLS_RIGHT = '0.95rem';
/** 찜 토글(2.65rem)과 그 아래 분류 카드 사이 간격. */
export const MOBILE_MAP_CONTROLS_GAP = '0.6rem';
export const MOBILE_MAP_RAIL_TOP = `calc(${MOBILE_MAP_CONTROLS_TOP} + 2.65rem + ${MOBILE_MAP_CONTROLS_GAP})`;
