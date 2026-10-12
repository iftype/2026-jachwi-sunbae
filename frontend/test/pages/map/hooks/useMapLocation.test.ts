import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import useMapLocation from '@/pages/map/hooks/useMapLocation';
import {
  readGeolocationPermission,
  readLastMapCenter,
  requestCurrentMapLocation,
} from '@/features/map/lib/mapLocation';

vi.mock('@/features/map/lib/mapLocation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/map/lib/mapLocation')>()),
  readLastMapCenter: vi.fn(() => null),
  requestCurrentMapLocation: vi.fn(),
  readGeolocationPermission: vi.fn(async () => 'denied'),
}));

describe('지도 위치 이동', () => {
  it('현재 위치 요청 도중 대체 매물이 바뀌면 실패 시점의 좌표를 사용한다', async () => {
    vi.mocked(readLastMapCenter).mockReturnValue(null);
    let rejectLocation: (reason: Error) => void = () => undefined;
    vi.mocked(requestCurrentMapLocation).mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectLocation = reject;
        }),
    );
    let fallback = { latitude: 37, longitude: 127, label: '이전 매물' };
    const { result } = renderHook(() => useMapLocation());
    let pending: ReturnType<typeof result.current.moveToCurrentLocation> = Promise.resolve(null);
    act(() => {
      pending = result.current.moveToCurrentLocation(() => fallback);
    });
    fallback = { latitude: 38, longitude: 128, label: '새 매물' };
    await act(async () => {
      rejectLocation(new Error('위치 실패'));
      await pending;
    });
    expect(result.current.viewportCenter).toEqual({ latitude: 38, longitude: 128 });
    expect(result.current.locationLabel).toBe('새 매물');
    expect(result.current.locationStatus).toBe('fallback');
  });

  it('클러스터 좌표로 이동해도 실제 현재 위치 표시는 바뀌지 않는다', () => {
    const { result } = renderHook(() => useMapLocation());
    act(() => result.current.moveToCoordinate({ latitude: 36, longitude: 126 }));
    expect(result.current.viewportCenter).toEqual({ latitude: 36, longitude: 126 });
    expect(result.current.currentPosition).toBeNull();
  });

  it('주소 검색과 지도 이동은 GPS 좌표를 덮어쓰지 않는다', async () => {
    const gps = { latitude: 37.5, longitude: 127 };
    vi.mocked(requestCurrentMapLocation).mockResolvedValue(gps);
    const { result } = renderHook(() => useMapLocation());
    await act(async () => {
      await result.current.moveToCurrentLocation(() => undefined);
    });
    act(() =>
      result.current.moveToAddress({
        latitude: 37.6,
        longitude: 127.1,
        address: '검색 위치',
        roadAddress: null,
        jibunAddress: null,
      }),
    );
    expect(result.current.currentPosition).toEqual(gps);
    act(() => result.current.panTo({ latitude: 37.7, longitude: 127.2 }));
    expect(result.current.currentPosition).toEqual(gps);
  });

  it('위치 권한을 이미 허용했다면 들어오자마자 현재 위치로 이동한다', async () => {
    const gps = { latitude: 37.5, longitude: 127 };
    vi.mocked(readLastMapCenter).mockReturnValue(null);
    vi.mocked(readGeolocationPermission).mockResolvedValueOnce('granted');
    vi.mocked(requestCurrentMapLocation).mockResolvedValue(gps);
    const { result } = renderHook(() => useMapLocation());
    await waitFor(() => expect(result.current.currentPosition).toEqual(gps));
    expect(result.current.viewportCenter).toEqual(gps);
    expect(result.current.locationLabel).toBe('현재 위치');
  });

  it('이번 세션에서 보던 위치가 있으면 현재 위치만 표시하고 화면은 옮기지 않는다', async () => {
    const gps = { latitude: 37.5, longitude: 127 };
    const lastCenter = { latitude: 36, longitude: 126 };
    vi.mocked(readLastMapCenter).mockReturnValue(lastCenter);
    vi.mocked(readGeolocationPermission).mockResolvedValueOnce('granted');
    vi.mocked(requestCurrentMapLocation).mockResolvedValue(gps);
    const { result } = renderHook(() => useMapLocation());
    await waitFor(() => expect(result.current.currentPosition).toEqual(gps));
    expect(result.current.viewportCenter).toEqual(lastCenter);
  });

  it('위치 권한을 허용하지 않았다면 들어올 때 위치를 요청하지 않는다', async () => {
    vi.mocked(requestCurrentMapLocation).mockClear();
    vi.mocked(readGeolocationPermission).mockResolvedValueOnce('prompt');
    renderHook(() => useMapLocation());
    await act(async () => {});
    expect(requestCurrentMapLocation).not.toHaveBeenCalled();
  });
});
