/**
 * 휴대폰 지도 오른쪽 컨트롤 열(찜 토글, 시설 분류 카드)의 위쪽 시작 위치와 간격.
 * 확대 축소 버튼을 없앴으므로 지도 머리 줄 바로 아래에서 시작한다. 내 기록과 동네 찾기가 함께 쓴다.
 */
export const MOBILE_MAP_CONTROLS_TOP = 'calc(max(0.85rem, env(safe-area-inset-top)) + 8rem)';
export const MOBILE_MAP_CONTROLS_RIGHT = '0.95rem';
/** 찜 토글(2.65rem)과 그 아래 분류 카드 사이 간격. */
export const MOBILE_MAP_CONTROLS_GAP = '0.6rem';
export const MOBILE_MAP_RAIL_TOP = `calc(${MOBILE_MAP_CONTROLS_TOP} + 2.65rem + ${MOBILE_MAP_CONTROLS_GAP})`;

/**
 * 데스크탑 지도 오른쪽 컨트롤 열. 위에서부터 확대 축소 버튼(4.75rem에서 시작해 약 5.3rem), 찜 토글, 시설 분류 카드를 쌓고,
 * 현재 위치 버튼은 열에서 떼어 오른쪽 아래 모서리에 둔다. 오른쪽 가장자리 기준이라 떠 있는 패널과 상세 패널이 열려도 자리가 같다.
 * 내 기록과 동네 찾기가 함께 쓴다.
 */
export const DESKTOP_MAP_CONTROLS_TOP = '10.55rem';
export const DESKTOP_MAP_CONTROLS_RIGHT = '1.15rem';
export const DESKTOP_MAP_RAIL_TOP = `calc(${DESKTOP_MAP_CONTROLS_TOP} + 2.65rem + ${MOBILE_MAP_CONTROLS_GAP})`;
/** 현재 위치 버튼이 지도 아래 가장자리에서 떨어지는 거리. */
export const DESKTOP_MAP_LOCATE_BOTTOM = '1.25rem';
