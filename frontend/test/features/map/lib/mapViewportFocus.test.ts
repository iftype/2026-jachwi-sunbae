// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { getMapFocusCenter } from '@/features/map/lib/mapViewportFocus';

describe('지도 초점 중심 계산', () => {
  const coordinate = { latitude: 37.5, longitude: 127 };

  it('매물 좌표를 변경하지 않고 화면 중심을 남동쪽으로 이동해 매물이 왼쪽 위에 보이게 한다', () => {
    const center = getMapFocusCenter(coordinate, 4, 390, 700);
    expect(center.latitude).toBeLessThan(coordinate.latitude);
    expect(center.longitude).toBeGreaterThan(coordinate.longitude);
    expect(coordinate).toEqual({ latitude: 37.5, longitude: 127 });
    const closer = getMapFocusCenter(coordinate, 2, 390, 700);
    expect(Math.abs(closer.latitude - coordinate.latitude)).toBeLessThan(
      Math.abs(center.latitude - coordinate.latitude),
    );
  });

  it('레벨 4에서 390x700 화면이면 가로 8%, 세로 10%만큼 중심을 옮긴 좌표를 돌려준다', () => {
    const center = getMapFocusCenter(coordinate, 4, 390, 700);
    expect(center.longitude).toBeCloseTo(127.000669479, 8);
    expect(center.latitude).toBeCloseTo(37.498808344, 8);
  });

  it('한 단계 확대하면 이동 거리가 정확히 절반이 된다', () => {
    const wide = getMapFocusCenter(coordinate, 4, 390, 700);
    const close = getMapFocusCenter(coordinate, 3, 390, 700);
    expect(close.longitude - coordinate.longitude).toBeCloseTo((wide.longitude - coordinate.longitude) / 2, 10);
  });

  it('화면 폭은 경도 이동에만, 화면 높이는 위도 이동에만 영향을 준다', () => {
    const base = getMapFocusCenter(coordinate, 4, 390, 700);
    const wider = getMapFocusCenter(coordinate, 4, 780, 700);
    const taller = getMapFocusCenter(coordinate, 4, 390, 1_400);
    expect(wider.longitude - coordinate.longitude).toBeCloseTo((base.longitude - coordinate.longitude) * 2, 10);
    expect(wider.latitude).toBeCloseTo(base.latitude, 10);
    expect(taller.longitude).toBeCloseTo(base.longitude, 10);
    expect(coordinate.latitude - taller.latitude).toBeGreaterThan((coordinate.latitude - base.latitude) * 1.9);
  });

  it('적도에서는 위도 이동이 메르카토르 보정 없이 화면 비율대로 계산된다', () => {
    const center = getMapFocusCenter({ latitude: 0, longitude: 0 }, 4, 390, 700);
    expect(center.longitude).toBeCloseTo(0.00066947937, 10);
    expect(center.latitude).toBeCloseTo(-0.00150203705, 10);
  });

  it('레벨 14 이상은 같은 최소 월드 크기를 써서 결과가 같다', () => {
    expect(getMapFocusCenter(coordinate, 14, 390, 700)).toEqual(getMapFocusCenter(coordinate, 15, 390, 700));
  });
});
