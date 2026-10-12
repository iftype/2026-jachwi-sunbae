import { trackPostHogEvent } from '@/shared/lib/analytics/posthog';

/** 앱스토어 이동은 설치 완료가 아니라 클릭으로만 해석한다. */
export const trackLandingCta = (destination: 'app_store' | 'web', placement: 'brand' | 'actions') =>
  trackPostHogEvent('landing_cta_clicked', { destination, placement });
