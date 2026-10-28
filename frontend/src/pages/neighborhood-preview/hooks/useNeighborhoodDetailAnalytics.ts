import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { trackPostHogEvent } from '@/shared/lib/analytics/posthog';

type DetailOptions = {
  mock: boolean;
  ready: boolean;
  failed?: boolean;
  itemKey: string | null;
  /** 상세에서 동네 월세 시세를 함께 보여줬는지. */
  hasRent: boolean;
};

const useNeighborhoodDetailAnalytics = (options: DetailOptions) => {
  const location = useLocation();
  const emitted = useRef<string | null>(null);
  useEffect(() => {
    if ((!options.ready && !options.failed) || !options.itemKey) return;
    const key = `${location.key}:${options.itemKey}:${options.failed ? 'failed' : 'viewed'}`;
    if (emitted.current === key) return;
    emitted.current = key;
    trackPostHogEvent(options.failed ? 'commute_route_failed' : 'commute_route_viewed', {
      feature: 'commute',
      entrypoint: location.pathname.startsWith('/explore/') ? 'public_explore' : 'neighborhoods',
      mock_data: options.mock,
      has_rent: options.hasRent,
    });
  }, [location.key, location.pathname, options.mock, options.ready, options.failed, options.itemKey, options.hasRent]);
};

export default useNeighborhoodDetailAnalytics;
