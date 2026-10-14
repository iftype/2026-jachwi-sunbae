import { afterEach, describe, expect, it, vi } from 'vitest';

import { trackLandingCta, trackLandingDemoInteraction } from '@/pages/landing/lib/landingAnalytics';

const { trackEvent } = vi.hoisted(() => ({ trackEvent: vi.fn() }));
vi.mock('@/shared/lib/analytics/posthog', () => ({ trackPostHogEvent: trackEvent }));
describe('랜딩 시작 버튼 지표', () => {
  afterEach(() => vi.clearAllMocks());
  it.each(['app_store', 'google_play', 'web'] as const)('%s 이동을 설치가 아닌 클릭으로 기록한다', (destination) => {
    trackLandingCta(destination, 'actions');
    expect(trackEvent).toHaveBeenCalledExactlyOnceWith('landing_cta_clicked', {
      destination,
      placement: 'actions',
      page_kind: 'landing',
    });
  });
  it('서비스 소개 페이지의 CTA는 랜딩 클릭률 분자에서 구분할 수 있다', () => {
    window.history.replaceState(null, '', '/about');
    trackLandingCta('web', 'actions');
    expect(trackEvent).toHaveBeenCalledExactlyOnceWith('landing_cta_clicked', {
      destination: 'web',
      placement: 'actions',
      page_kind: 'about',
    });
  });
  it('시연 버튼 조작을 실제 검색·등록과 다른 이벤트로 기록한다', () => {
    trackLandingDemoInteraction('mode', 'price');
    expect(trackEvent).toHaveBeenCalledExactlyOnceWith('landing_demo_interacted', {
      action: 'mode',
      value: 'price',
    });
  });
});
