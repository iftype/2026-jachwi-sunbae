/** 지도 단계는 작을수록 가깝다. 확대와 축소에 동일한 표시 기준을 적용한다. */
export const FACILITY_MARKER_LEVEL = 8.5;
export const DESKTOP_FACILITY_MARKER_LEVEL = 6.5;
/** 정수 줌을 사용하는 지도에서도 표시 범위 안으로 확대한다. */
export const facilityFocusLevel = (markerLevel: number) => Math.floor(markerLevel);
export const facilityMarkersVisible = (level: number, markerLevel = FACILITY_MARKER_LEVEL) =>
  Math.round(level * 100) / 100 <= markerLevel;
