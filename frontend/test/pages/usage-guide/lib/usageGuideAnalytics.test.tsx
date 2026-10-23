import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';

const { trackEvent } = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock('@/shared/lib/analytics/posthog', () => ({ trackPostHogEvent: trackEvent }));

import { useUsageGuideViewTracking } from '@/pages/usage-guide/lib/usageGuideAnalytics';

it('사용 방법 진입을 다시 그려져도 한 번만 기록한다', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={['/guide']}>{children}</MemoryRouter>
  );
  const { rerender } = renderHook(() => useUsageGuideViewTracking(), { wrapper });
  rerender();

  expect(trackEvent).toHaveBeenCalledExactlyOnceWith('usage_guide_viewed');
});
