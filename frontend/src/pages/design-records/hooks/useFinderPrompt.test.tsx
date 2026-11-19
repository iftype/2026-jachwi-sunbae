import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MapModeProvider } from '@/shared/ui/map-mode-tile/MapModeContext';

import { hasUsedFinder } from '../model/finderUsed';
import { useFinderPrompt } from './useFinderPrompt';

const mockBookmarks = vi.hoisted(() => ({ codes: [] as string[], isLoading: false }));

vi.mock('@/features/map/api/useAdminDongBookmarks', () => ({
  useAdminDongBookmarks: () => mockBookmarks,
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <MapModeProvider value={{ target: 'neighborhoods', onSwitch: vi.fn() }}>{children}</MapModeProvider>
);

describe('useFinderPrompt', () => {
  beforeEach(() => {
    localStorage.clear();
    mockBookmarks.codes = [];
    mockBookmarks.isLoading = false;
  });

  it('찜도 사용 기록도 없으면 안내를 보여 준다', () => {
    const { result } = renderHook(() => useFinderPrompt(), { wrapper });
    expect(result.current).not.toBeNull();
  });

  it('찜한 동네가 있으면 안내를 숨기고 사용 기록을 남긴다', () => {
    mockBookmarks.codes = ['1144065000'];
    const { result } = renderHook(() => useFinderPrompt(), { wrapper });
    expect(result.current).toBeNull();
    expect(hasUsedFinder()).toBe(true);
  });

  it('찜을 모두 풀어도 안내가 돌아오지 않는다', () => {
    mockBookmarks.codes = ['1144065000'];
    const first = renderHook(() => useFinderPrompt(), { wrapper });
    first.unmount();
    mockBookmarks.codes = [];
    const { result } = renderHook(() => useFinderPrompt(), { wrapper });
    expect(result.current).toBeNull();
  });

  it('찜 목록을 불러오는 중에는 안내를 숨긴다', () => {
    mockBookmarks.isLoading = true;
    const { result } = renderHook(() => useFinderPrompt(), { wrapper });
    expect(result.current).toBeNull();
  });

  it('통합 지도 밖이면 안내가 없다', () => {
    const { result } = renderHook(() => useFinderPrompt());
    expect(result.current).toBeNull();
  });
});
