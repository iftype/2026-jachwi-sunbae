import { afterEach, describe, expect, it } from 'vitest';

import { MAP_TIMING, markMapTiming } from './mapTiming';

describe('markMapTiming', () => {
  afterEach(() => performance.clearMarks());

  it('지도 판정이 읽는 이름으로 User Timing 표시를 남긴다', () => {
    markMapTiming(MAP_TIMING.overlayAttached);

    expect(performance.getEntriesByName('jachwi:map-overlay-attached', 'mark')).toHaveLength(1);
  });

  it('같은 표시는 처음 한 번만 남겨 첫 오버레이 시각을 지킨다', () => {
    markMapTiming(MAP_TIMING.sdkReady);
    const first = performance.getEntriesByName(MAP_TIMING.sdkReady, 'mark')[0]?.startTime;
    markMapTiming(MAP_TIMING.sdkReady);

    const marks = performance.getEntriesByName(MAP_TIMING.sdkReady, 'mark');
    expect(marks).toHaveLength(1);
    expect(marks[0]?.startTime).toBe(first);
  });
});
