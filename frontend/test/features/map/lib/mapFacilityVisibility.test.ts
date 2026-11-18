// @vitest-environment node
import { expect, it } from 'vitest';

import {
  DESKTOP_FACILITY_MARKER_LEVEL,
  FACILITY_MARKER_LEVEL,
  facilityFocusLevel,
  facilityMarkersVisible,
} from '@/features/map/lib/mapFacilityVisibility';

it('데스크탑은 더 가까운 지도에서 표시하고 확대와 축소에 같은 기준을 쓴다', () => {
  expect(facilityMarkersVisible(8, FACILITY_MARKER_LEVEL)).toBe(true);
  expect(facilityMarkersVisible(8, DESKTOP_FACILITY_MARKER_LEVEL)).toBe(false);
  for (const level of [7, 6.5, 6.51, 6.49, 7]) {
    expect(facilityMarkersVisible(level, DESKTOP_FACILITY_MARKER_LEVEL)).toBe(level <= 6.5);
  }
  expect(facilityMarkersVisible(6.5000001, DESKTOP_FACILITY_MARKER_LEVEL)).toBe(true);
  expect(facilityFocusLevel(DESKTOP_FACILITY_MARKER_LEVEL)).toBe(6);
  expect(facilityFocusLevel(FACILITY_MARKER_LEVEL)).toBe(8);
});
