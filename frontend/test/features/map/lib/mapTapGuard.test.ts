import { describe, expect, it } from 'vitest';

import { createMapTapGuard } from '@/features/map/lib/mapTapGuard';

describe('지도 위치 선택 제스처', () => {
  it('작은 손떨림은 탭으로 받고 드래그와 취소 뒤 클릭은 막는다', () => {
    let now = 0;
    const guard = createMapTapGuard(() => now);
    guard.start(1, 10, 10);
    guard.move(1, 13, 14);
    guard.end(1);
    expect(guard.allowsTap()).toBe(true);
    guard.start(2, 10, 10);
    guard.move(2, 30, 10);
    guard.end(2);
    expect(guard.allowsTap()).toBe(false);
    now = 500;
    guard.start(3, 10, 10);
    guard.end(3);
    expect(guard.allowsTap()).toBe(true);
    guard.start(4, 10, 10);
    guard.end(4, true);
    expect(guard.allowsTap()).toBe(false);
  });

  it('두 손가락 핀치가 끝난 뒤 SDK 클릭과 확대 중 클릭은 막는다', () => {
    let now = 0;
    const guard = createMapTapGuard(() => now);
    guard.start(1, 0, 0);
    guard.start(2, 100, 0);
    guard.end(1);
    guard.end(2);
    expect(guard.allowsTap()).toBe(false);
    now = 500;
    guard.start(3, 0, 0);
    guard.end(3);
    expect(guard.allowsTap()).toBe(true);
    guard.block();
    expect(guard.allowsTap()).toBe(false);
  });
});
