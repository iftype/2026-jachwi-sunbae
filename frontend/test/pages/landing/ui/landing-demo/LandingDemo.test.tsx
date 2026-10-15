import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { trackEvent } = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock('@/shared/lib/analytics/posthog', () => ({ trackPostHogEvent: trackEvent }));

import LandingDemo from '@/pages/landing/ui/landing-demo/LandingDemo';

type ObserverCallback = (entries: Array<{ isIntersecting: boolean; target: Element }>) => void;
let observers: Array<{ callback: ObserverCallback; target?: Element }> = [];

class FakeIntersectionObserver {
  private readonly record: { callback: ObserverCallback; target?: Element };
  constructor(callback: ObserverCallback) {
    this.record = { callback };
    observers.push(this.record);
  }
  observe(target: Element) {
    this.record.target = target;
  }
  disconnect() {}
}

const reveal = (title: string) => {
  const step = screen.getByText(title).closest('article');
  const observer = observers.find((item) => item.target === step);
  act(() => observer?.callback([{ isIntersecting: true, target: step! }]));
};

beforeEach(() => {
  trackEvent.mockClear();
  observers = [];
  vi.useFakeTimers();
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it('동네 찾기·등록·저장·체크리스트 단계를 버튼 없이 스크롤로 나열한다', () => {
  render(<LandingDemo />);
  expect(screen.getByRole('heading', { name: '자취할 동네 찾기' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '매물 추가' })).toBeInTheDocument();
  expect(screen.getByText('✓ 매물을 저장했어요')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '현장 체크리스트' })).toBeInTheDocument();
  expect(screen.queryByLabelText('사용 예시 단계')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /일시정지|시연 재생/ })).not.toBeInTheDocument();
});
it('단계가 화면에 들어올 때 시연을 한 번 재생하고 마지막 장면에 멈춘다', () => {
  render(<LandingDemo />);
  act(() => vi.advanceTimersByTime(5000));
  expect(screen.getByText('0 / 3 확인')).toBeInTheDocument();
  reveal('체크리스트');
  act(() => vi.advanceTimersByTime(5000));
  expect(screen.getByText('3 / 3 확인')).toBeInTheDocument();
  expect(screen.getByText('보러 갈 방 이름')).toBeInTheDocument();
  expect(trackEvent).not.toHaveBeenCalled();
});
it('탐색 모드를 직접 고르면 예시 값과 이벤트가 바뀐다', () => {
  render(<LandingDemo />);
  fireEvent.click(screen.getByRole('button', { name: '월세 평균가' }));
  expect(screen.getByText('40만원')).toBeInTheDocument();
  expect(trackEvent).toHaveBeenCalledExactlyOnceWith('landing_demo_interacted', { action: 'mode', value: 'price' });
});
