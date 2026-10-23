import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { trackPostHogEvent } from '@/shared/lib/analytics/posthog';

/** StrictMode의 effect 중복 실행은 빼고, 같은 화면에 다시 들어올 때마다 한 번 기록한다. */
export const useUsageGuideViewTracking = () => {
  const location = useLocation();
  const tracked = useRef<string | null>(null);
  useEffect(() => {
    if (tracked.current === location.key) return;
    tracked.current = location.key;
    trackPostHogEvent('usage_guide_viewed');
  }, [location.key]);
};

/** 자동 시연은 실제 기능 사용으로 수집하지 않는다. */
export const trackUsageGuideDemoInteraction = (action: 'mode', value: string) =>
  trackPostHogEvent('usage_guide_demo_interacted', { action, value });
