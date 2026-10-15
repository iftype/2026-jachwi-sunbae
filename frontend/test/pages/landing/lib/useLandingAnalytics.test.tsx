import { renderHook } from '@testing-library/react';
import { type ReactNode, StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';

import useLandingAnalytics from '@/pages/landing/lib/useLandingAnalytics';
import { trackPostHogEvent } from '@/shared/lib/analytics/posthog';

vi.mock('@/shared/lib/analytics/posthog', () => ({ trackPostHogEvent: vi.fn() }));
beforeEach(() => vi.mocked(trackPostHogEvent).mockClear());
const wrapper = ({ children }: { children: ReactNode }) => (
  <StrictMode>
    <MemoryRouter initialEntries={['/landing']}>{children}</MemoryRouter>
  </StrictMode>
);
it('신규 랜딩 방문은 StrictMode·재렌더에서도 한 번만 기록한다', () => {
  const { rerender } = renderHook(() => useLandingAnalytics('exploration_v1'), { wrapper });
  rerender();
  expect(trackPostHogEvent).toHaveBeenCalledExactlyOnceWith('landing_page_viewed', {
    landing_variant: 'exploration_v1',
  });
});
it('서비스 소개 페이지를 랜딩 방문 분모에 넣지 않는다', () => {
  renderHook(() => useLandingAnalytics('exploration_v1'), {
    wrapper: ({ children }) => <MemoryRouter initialEntries={['/about']}>{children}</MemoryRouter>,
  });
  expect(trackPostHogEvent).toHaveBeenCalledExactlyOnceWith('service_introduction_viewed', {
    landing_variant: 'exploration_v1',
  });
});
