import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { trackPostHogEvent } from '@/shared/lib/analytics/posthog';

const useLandingAnalytics = (variant: 'instagram_v1' | 'exploration_v1') => {
  const location = useLocation();
  const tracked = useRef<string | null>(null);
  useEffect(() => {
    if (tracked.current === location.key) return;
    tracked.current = location.key;
    trackPostHogEvent(location.pathname === '/about' ? 'service_introduction_viewed' : 'landing_page_viewed', {
      landing_variant: variant,
    });
  }, [location.key, location.pathname, variant]);
};

export default useLandingAnalytics;
