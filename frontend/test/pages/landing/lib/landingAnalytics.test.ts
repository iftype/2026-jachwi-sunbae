import { afterEach, describe, expect, it, vi } from 'vitest';

import { trackLandingCta } from '@/pages/landing/lib/landingAnalytics';

const { trackEvent } = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock('@/shared/lib/analytics/posthog', () => ({ trackPostHogEvent: trackEvent }));
describe('랜딩 시작 버튼 지표', () => {
  afterEach(() => vi.clearAllMocks());
  it.each(['app_store', 'web'] as const)('%s 이동을 설치가 아닌 클릭으로 기록한다', (destination) => {
    trackLandingCta(destination, 'actions');
    expect(trackEvent).toHaveBeenCalledExactlyOnceWith('landing_cta_clicked', { destination, placement: 'actions' });
  });
});
