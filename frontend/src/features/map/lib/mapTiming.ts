/**
 * 지도 화면 판정(.claude/skills/verify-jachwi/scripts/measure.mjs 의 `--moment map-overlay`)이 읽는 표준 User Timing 표시다.
 * 네이버 지도 타일은 받을 때마다 속도가 달라 우리 코드와 무관하게 흔들린다. 그래서 판정은 SDK 준비부터 우리 오버레이가
 * 지도에 붙은 시각까지만 재고, SDK 준비까지 걸린 시간은 따로 적는다. 페이지마다 처음 한 번만 남긴다.
 * SDK 내부는 건드리지 않는다. 우리 코드가 SDK 공개 API를 부른 자리에서만 남긴다.
 */
export const MAP_TIMING = {
  sdkReady: 'jachwi:map-sdk-ready',
  mapCreated: 'jachwi:map-created',
  overlayAttached: 'jachwi:map-overlay-attached',
} as const;

type MapTimingName = (typeof MAP_TIMING)[keyof typeof MAP_TIMING];

export const markMapTiming = (name: MapTimingName): void => {
  if (typeof performance === 'undefined' || typeof performance.mark !== 'function') return;
  if (performance.getEntriesByName(name, 'mark').length > 0) return;
  performance.mark(name);
};
