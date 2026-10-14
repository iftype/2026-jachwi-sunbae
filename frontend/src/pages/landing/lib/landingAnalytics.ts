import { trackPostHogEvent } from '@/shared/lib/analytics/posthog';

/** 앱스토어 이동은 설치 완료가 아니라 클릭으로만 해석한다. */
export const trackLandingCta = (destination: 'app_store' | 'google_play' | 'web', placement: 'brand' | 'actions') =>
  trackPostHogEvent('landing_cta_clicked', {
    destination,
    placement,
    page_kind: window.location.pathname === '/about' ? 'about' : 'landing',
  });

/** 자동 시연은 실제 기능 사용으로 수집하지 않는다. */
export const trackLandingDemoInteraction = (action: 'step' | 'mode' | 'playback', value: string) =>
  trackPostHogEvent('landing_demo_interacted', { action, value });
