import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import useNearbyAnalysis from '@/pages/nearby-analysis/hooks/useNearbyAnalysis';
import { fetchBusStops } from '@/features/map/api/busStopApi';
import { fetchNearby } from '@/features/map/api/mapApi';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

vi.mock('@/features/map/api/mapApi', () => ({ fetchNearby: vi.fn() }));
vi.mock('@/features/map/api/busStopApi', () => ({ fetchBusStops: vi.fn() }));

const center = { latitude: 37.5, longitude: 127 };
const clients: QueryClient[] = [];
const renderAnalysis = (location: typeof center | null = center) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <PublicConfigProvider config={{ apiBaseUrl: '/api' }}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </PublicConfigProvider>
  );
  return renderHook(() => useNearbyAnalysis(1, location), { wrapper });
};

beforeEach(() => {
  vi.mocked(fetchNearby)
    .mockReset()
    .mockImplementation(async (_config, latitude, longitude, radius) => ({
      center: { latitude, longitude },
      radius,
      counts: { HOSPITAL: 45, SCHOOL: 1, CONVENIENCE: 0, AGENCY: 0 },
      places: [],
    }));
  vi.mocked(fetchBusStops)
    .mockReset()
    .mockImplementation(async (_config, latitude, longitude, radius) => ({
      center: { latitude, longitude },
      radius,
      count: 33,
      busStops: Array.from({ length: 33 }, (_, index) => ({
        nodeId: `stop-${index}`,
        name: `정류장 ${index}`,
        latitude,
        longitude,
        distanceMeters: index + 1,
      })),
    }));
});
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
});

describe('매물 주변 분석 교통 집계', () => {
  it('초기 미선택 상태에서 두 API를 조회하되 정류장 마커는 표시하지 않는다', async () => {
    const { result } = renderAnalysis();
    await waitFor(() => expect(result.current.nearby.isSuccess).toBe(true));
    expect(fetchNearby).toHaveBeenCalledTimes(1);
    expect(fetchBusStops).toHaveBeenCalledTimes(1);
    expect(result.current.nearby.data.counts).toMatchObject({ HOSPITAL: 45, TRANSPORT: 33, SCHOOL: 1 });
    expect(result.current.selectedCategories).toEqual([]);
    expect(result.current.places).toEqual([]);
    expect(result.current.markers).toHaveLength(1);
    act(() => result.current.selectCategory('TRANSPORT'));
    expect(result.current.places).toHaveLength(33);
    act(() => result.current.selectCategory('TRANSPORT'));
    expect(result.current.places).toEqual([]);
    expect(result.current.nearby.data.counts.TRANSPORT).toBe(33);
    expect(fetchBusStops).toHaveBeenCalledTimes(1);
  });
  it('교통 선택 여부와 관계없이 반경 변경 시 두 API를 갱신한다', async () => {
    const { result } = renderAnalysis();
    await waitFor(() => expect(result.current.nearby.isSuccess).toBe(true));
    for (const radius of [500, 1000] as const) {
      act(() => result.current.selectRadius(radius));
      await waitFor(() => expect(result.current.nearby.isSuccess).toBe(true));
      expect(fetchNearby).toHaveBeenCalledWith(
        expect.anything(),
        center.latitude,
        center.longitude,
        radius,
        expect.any(Array),
        expect.any(AbortSignal),
      );
      expect(fetchBusStops).toHaveBeenCalledWith(
        expect.anything(),
        center.latitude,
        center.longitude,
        radius,
        expect.any(AbortSignal),
      );
    }
  });
  it('정류장 응답을 기다리는 중에는 조회 완료로 취급하지 않는다', async () => {
    let resolveStops: ((value: Awaited<ReturnType<typeof fetchBusStops>>) => void) | undefined;
    vi.mocked(fetchBusStops).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveStops = resolve;
        }),
    );
    const { result } = renderAnalysis();
    await waitFor(() => expect(fetchNearby).toHaveBeenCalledTimes(1));
    expect(result.current.nearby.isPending).toBe(true);
    expect(result.current.nearby.isSuccess).toBe(false);
    act(() => resolveStops?.({ center, radius: 2000, count: 0, busStops: [] }));
    await waitFor(() => expect(result.current.nearby.isSuccess).toBe(true));
    expect(result.current.nearby.data.counts.TRANSPORT).toBe(0);
  });
  it('정류장 실패는 전체 조회 성공과 구분하고 재시도 시 두 API를 호출한다', async () => {
    vi.mocked(fetchBusStops).mockRejectedValueOnce(new Error('정류장 조회 실패'));
    const { result } = renderAnalysis();
    await waitFor(() => expect(result.current.nearby.isError).toBe(true));
    expect(result.current.nearby.isSuccess).toBe(false);
    await act(async () => {
      await result.current.nearby.refetch();
    });
    await waitFor(() => expect(result.current.nearby.isSuccess).toBe(true));
    expect(fetchNearby).toHaveBeenCalledTimes(2);
    expect(fetchBusStops).toHaveBeenCalledTimes(2);
    expect(result.current.nearby.data.counts.TRANSPORT).toBe(33);
  });
  it('매물 좌표가 없으면 어느 API도 호출하지 않는다', () => {
    renderAnalysis(null);
    expect(fetchNearby).not.toHaveBeenCalled();
    expect(fetchBusStops).not.toHaveBeenCalled();
  });
});
