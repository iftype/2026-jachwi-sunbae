import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import useMapSearch from '@/pages/map/hooks/useMapSearch';
import { searchAddress } from '@/features/map/api/mapApi';

vi.mock('@/shared/config/PublicConfigContext', () => ({ usePublicConfig: () => ({ apiBaseUrl: '/api' }) }));
vi.mock('@/features/map/api/mapApi', () => ({ searchAddress: vi.fn() }));

describe('지도 검색 동작', () => {
  it('현재 입력으로 검색하고 빈 입력 및 닫기에서 검색 상태를 초기화한다', async () => {
    vi.mocked(searchAddress).mockResolvedValue([
      { address: '서울', roadAddress: null, jibunAddress: null, latitude: 37, longitude: 127 },
    ]);
    const { result } = renderHook(() => useMapSearch());
    act(() => {
      result.current.openSearch();
      result.current.changeQuery(' 서울 ');
    });
    await act(async () => {
      await result.current.submitSearch();
    });
    expect(searchAddress).toHaveBeenCalledWith({ apiBaseUrl: '/api' }, '서울', expect.any(AbortSignal));
    expect(result.current.searchResults).toHaveLength(1);
    act(() => result.current.changeQuery('  '));
    expect(result.current.searchResults).toEqual([]);
    expect(result.current.searchQuery).toBe('');
    expect(result.current.searchStatus).toBe('idle');
    act(() => result.current.closeSearch());
    expect(result.current.searchOpen).toBe(false);
  });
});
