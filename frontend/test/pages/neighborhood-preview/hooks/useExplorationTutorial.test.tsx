import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import useExplorationTutorial from '@/pages/neighborhood-preview/hooks/useExplorationTutorial';
import { trackPostHogEvent } from '@/shared/lib/analytics/posthog';

vi.mock('@/shared/lib/analytics/posthog', () => ({ trackPostHogEvent: vi.fn() }));
beforeEach(() => vi.mocked(trackPostHogEvent).mockClear());
const options = { enabled: true, mode: 'commute' as const, hasLocation: false, mock: true };
it('실제 위치 선택과 필터 적용에 따라 안내가 진행된다', () => {
  const { result, rerender } = renderHook((props) => useExplorationTutorial(props), { initialProps: options });
  expect(result.current.step).toBe('location');
  rerender({ ...options, hasLocation: true });
  expect(result.current.step).toBe('filter');
  act(() => result.current.applyFilter());
  expect(result.current.step).toBe('search');
  act(() => result.current.complete());
  expect(result.current.isOpen).toBe(false);
  expect(trackPostHogEvent).toHaveBeenCalledWith('exploration_tutorial_completed', {
    exploration_mode: 'commute',
    mock_data: true,
  });
  expect(vi.mocked(trackPostHogEvent).mock.calls.map(([event]) => event)).not.toContain('exploration_completed');
});
it('건너뛰면 같은 탐색의 다음 진입에서는 표시하지 않는다', () => {
  const view = renderHook(() => useExplorationTutorial(options));
  act(() => view.result.current.skip());
  view.unmount();
  expect(renderHook(() => useExplorationTutorial(options)).result.current.isOpen).toBe(false);
  expect(renderHook(() => useExplorationTutorial({ ...options, mode: 'price' })).result.current.isOpen).toBe(true);
});
it('기존 서비스 화면에는 안내를 추가하지 않는다', () => {
  const { result } = renderHook(() => useExplorationTutorial({ ...options, enabled: false }));
  expect(result.current.isOpen).toBe(false);
  expect(trackPostHogEvent).not.toHaveBeenCalled();
});
