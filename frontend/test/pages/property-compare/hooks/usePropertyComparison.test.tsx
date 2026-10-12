import { act, renderHook } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import usePropertyComparison from '@/pages/property-compare/hooks/usePropertyComparison';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';
const { trackEvent, recordView } = vi.hoisted(() => ({ trackEvent: vi.fn(), recordView: vi.fn() }));
vi.mock('@/shared/lib/analytics/posthog', () => ({ trackPostHogEvent: trackEvent }));
vi.mock('@/features/property/api/usePropertyMutations', () => ({
  useRecordPropertyComparisonView: () => ({ mutate: recordView }),
}));
const wrapper = ({ children }: PropsWithChildren) => (
  <StrictMode>
    <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost:8080' }}>{children}</PublicConfigProvider>
  </StrictMode>
);
describe('매물 비교 이벤트', () => {
  afterEach(() => vi.resetAllMocks());
  it('StrictMode에서도 비교 방문과 각 선택을 한 번만 보낸다', () => {
    const { result } = renderHook(() => usePropertyComparison(), { wrapper });
    expect(recordView).toHaveBeenCalledOnce();
    expect(trackEvent).toHaveBeenCalledExactlyOnceWith('property_comparison_started');
    act(() => result.current.toggle(1));
    act(() => result.current.toggle(2));
    act(() => result.current.toggle(1));
    expect(result.current.selectedIds).toEqual([2]);
    expect(trackEvent.mock.calls.slice(1)).toEqual([
      ['property_selected_for_comparison', { selected: true, selected_count: 1 }],
      ['property_selected_for_comparison', { selected: true, selected_count: 2 }],
      ['property_selected_for_comparison', { selected: false, selected_count: 1 }],
    ]);
  });
  it('연속 호출의 선택 수를 정확히 기록하고 최대 개수 이후 선택은 기록하지 않는다', () => {
    const { result } = renderHook(() => usePropertyComparison(), { wrapper });
    act(() => {
      for (let id = 1; id <= 6; id += 1) result.current.toggle(id);
    });
    expect(result.current.selectedIds).toEqual([1, 2, 3, 4, 5]);
    expect(trackEvent).toHaveBeenCalledTimes(6);
    expect(trackEvent).toHaveBeenLastCalledWith('property_selected_for_comparison', {
      selected: true,
      selected_count: 5,
    });
  });
});
