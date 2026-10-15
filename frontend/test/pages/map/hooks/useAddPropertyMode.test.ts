import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import useAddPropertyMode from '@/pages/map/hooks/useAddPropertyMode';
import { reverseGeocode } from '@/features/map/api/mapApi';
import type { MapAddress } from '@/features/map/model/Map';

vi.mock('@/shared/config/PublicConfigContext', () => ({ usePublicConfig: () => ({ apiBaseUrl: '/api' }) }));
vi.mock('@/features/map/api/mapApi', () => ({ reverseGeocode: vi.fn() }));

const coordinate = { latitude: 37, longitude: 127 };
const address: MapAddress = { ...coordinate, address: '이전 주소', roadAddress: null, jibunAddress: null };

describe('매물 추가 위치의 주소 조회', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('중앙 핀이 이동하면 지연 조회 전에 이전 주소를 지운다', async () => {
    vi.useFakeTimers();
    vi.mocked(reverseGeocode).mockResolvedValue(address);
    const { result } = renderHook(() => useAddPropertyMode());
    await act(async () => result.current.enter(coordinate));
    expect(result.current.address).toEqual(address);
    act(() => result.current.handleCenterChange({ latitude: 38, longitude: 128 }));
    expect(result.current.address).toBeNull();
    expect(result.current.addressStatus).toBe('loading');
    expect(reverseGeocode).toHaveBeenCalledTimes(1);
    act(() => result.current.cancel());
    await act(async () => vi.advanceTimersByTimeAsync(450));
    expect(reverseGeocode).toHaveBeenCalledTimes(1);
  });

  it('취소 이후 도착한 주소는 반영하지 않는다', async () => {
    let resolve!: (value: MapAddress) => void;
    vi.mocked(reverseGeocode).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { result } = renderHook(() => useAddPropertyMode());
    act(() => result.current.enter(coordinate));
    act(() => result.current.cancel());
    await act(async () => resolve(address));
    expect(result.current.address).toBeNull();
    expect(result.current.addressStatus).toBe('idle');
    expect(result.current.isAddMode).toBe(false);
  });
});
