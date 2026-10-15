import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { trackEvent } = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock('@/shared/lib/analytics/posthog', () => ({ trackPostHogEvent: trackEvent }));

import LandingDemo from '@/pages/landing/ui/landing-demo/LandingDemo';

beforeEach(() => {
  trackEvent.mockClear();
  vi.useFakeTimers();
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it('하단 가상 정보 문구 없이 시연하고 키보드용 재생 제어는 유지한다', () => {
  render(<LandingDemo />);
  expect(screen.queryByText('가상 정보로 만든 사용 예시 · 저장되지 않아요')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '일시정지' }).className).toContain('playbackControl');
  fireEvent.click(screen.getByRole('button', { name: '일시정지' }));
  expect(screen.getByRole('button', { name: '시연 재생' })).toBeInTheDocument();
});
it('동네 찾기·등록·저장·체크리스트를 순서대로 시연한다', () => {
  render(<LandingDemo />);
  act(() => vi.advanceTimersByTime(3500));
  expect(screen.getByRole('heading', { name: '매물 추가' })).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(3500));
  expect(screen.getByText('✓ 매물을 저장했어요')).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(3500));
  expect(screen.getByRole('heading', { name: '현장 체크리스트' })).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(3500));
  expect(screen.getByRole('heading', { name: '자취할 동네 찾기' })).toBeInTheDocument();
  expect(trackEvent).not.toHaveBeenCalled();
});
it('직접 단계나 탐색 모드를 선택하면 시연이 멈춘다', () => {
  render(<LandingDemo />);
  fireEvent.click(screen.getByRole('button', { name: '월세 평균가' }));
  expect(screen.getByText('40만원')).toBeInTheDocument();
  expect(trackEvent).toHaveBeenCalledExactlyOnceWith('landing_demo_interacted', { action: 'mode', value: 'price' });
  fireEvent.click(screen.getByRole('button', { name: /체크리스트/ }));
  act(() => vi.advanceTimersByTime(5000));
  expect(screen.getByRole('heading', { name: '현장 체크리스트' })).toBeInTheDocument();
});
