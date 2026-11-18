import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import useNeighborhoodPlaces from '@/pages/neighborhood-preview/hooks/useNeighborhoodPlaces';

vi.mock('@/features/map/api/useViewportPlaces', () => ({
  useViewportPlaces: () => ({
    busStops: [{ nodeId: 'stop-1', name: '정류장', latitude: 37.5, longitude: 127 }],
    agencies: [],
    agenciesFailed: false,
    busStopsFailed: false,
  }),
}));

const bounds = { south: 37.49, west: 126.99, north: 37.51, east: 127.01 };

it('결과 지도를 떠났다 돌아오면 지도가 다시 멈추기 전까지 예전 확대 단계로 마커를 올리지 않는다', () => {
  const { result, rerender } = renderHook(useNeighborhoodPlaces, { initialProps: true });
  act(() => {
    result.current.rememberLevel(5);
    result.current.rememberBounds(bounds);
  });
  expect(result.current.isClose).toBe(true);
  expect(result.current.markers).toHaveLength(1);

  rerender(false);
  rerender(true);
  expect(result.current.isClose).toBe(false);
  expect(result.current.markers).toHaveLength(0);
  expect(result.current.bounds).toBeNull();

  act(() => {
    result.current.rememberLevel(5);
    result.current.rememberBounds(bounds);
  });
  expect(result.current.isClose).toBe(true);
});

it('확대하거나 축소해도 같은 단계에서 시설을 보이거나 숨긴다', () => {
  const { result } = renderHook(useNeighborhoodPlaces, { initialProps: true });
  act(() => result.current.rememberBounds(bounds));
  for (const [level, visible] of [
    [9, false],
    [8.5, true],
    [8.51, false],
    [8.49, true],
    [9, false],
  ] as const) {
    act(() => result.current.rememberLevel(level));
    expect(result.current.isClose).toBe(visible);
    expect(result.current.markers).toHaveLength(visible ? 1 : 0);
  }
});

it('멀리 볼 때는 지도가 멈출 때마다 범위가 바뀌어도 다시 렌더하지 않고, 가까이 다가가면 기억한 범위로 바로 조회한다', () => {
  let renders = 0;
  const { result } = renderHook(
    (enabled: boolean) => {
      renders += 1;
      return useNeighborhoodPlaces(enabled);
    },
    { initialProps: true },
  );
  const start = renders;
  // 전체 보기(단계 10)에서 지도를 세 번 옮겨 멈춘다.
  for (const shift of [0, 0.01, 0.02]) {
    act(() => {
      result.current.rememberLevel(10);
      result.current.rememberBounds({ ...bounds, west: bounds.west + shift, east: bounds.east + shift });
    });
  }
  expect(renders).toBe(start);
  expect(result.current.bounds).toBeNull();

  act(() => result.current.rememberLevel(5));
  expect(result.current.isClose).toBe(true);
  expect(result.current.bounds).toEqual({ ...bounds, west: bounds.west + 0.02, east: bounds.east + 0.02 });

  // 가까이 본 채 같은 범위로 다시 멈추면 범위 상태를 바꾸지 않는다.
  const near = renders;
  act(() => {
    result.current.rememberLevel(5);
    result.current.rememberBounds({ ...bounds, west: bounds.west + 0.02, east: bounds.east + 0.02 });
  });
  expect(renders).toBe(near);
});

it('고른 출발 정류장 마커는 누를 수 있고, 눌러도 지도 빈 곳 누르기로 넘어가 열어 둔 경로를 닫지 않는다', () => {
  const { result } = renderHook(useNeighborhoodPlaces, { initialProps: true });
  const station = { stopId: 'start-1', name: '출발 정류장', latitude: 37.5, longitude: 127 };
  act(() => result.current.selectStation(station));
  const marker = result.current.markers.find((item) => item.id.endsWith(station.stopId))!;
  // 누를 수 있는 마커만 지도 클릭으로 흘려보내지 않는다(MapMarkerView).
  expect(marker.actionable).toBe(true);

  act(() => result.current.selectMarker(marker));
  expect(result.current.selectedPlace).toEqual({ kind: 'station', station });
});
