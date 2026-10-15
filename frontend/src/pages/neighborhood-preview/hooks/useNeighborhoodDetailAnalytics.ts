import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { trackPostHogEvent } from '@/shared/lib/analytics/posthog';

type DetailOptions = {
  feature: 'rental' | 'commute';
  mock: boolean;
  ready: boolean;
  failed?: boolean;
  itemKey: string | null;
  transactionCount?: number;
};

const useNeighborhoodDetailAnalytics = (options: DetailOptions) => {
  const location = useLocation();
  const emitted = useRef<string | null>(null);
  useEffect(() => {
    if ((!options.ready && !options.failed) || !options.itemKey) return;
    const key = `${location.key}:${options.itemKey}:${options.failed ? 'failed' : 'viewed'}`;
    if (emitted.current === key) return;
    emitted.current = key;
    trackPostHogEvent(
      options.failed
        ? 'commute_route_failed'
        : options.feature === 'rental'
          ? 'rental_information_viewed'
          : 'commute_route_viewed',
      {
        feature: options.feature,
        entrypoint: location.pathname.startsWith('/explore/') ? 'public_explore' : 'neighborhoods',
        mock_data: options.mock,
        ...(options.feature === 'rental'
          ? { transaction_count: options.transactionCount ?? 0, has_transactions: (options.transactionCount ?? 0) > 0 }
          : {}),
      },
    );
  }, [
    location.key,
    location.pathname,
    options.feature,
    options.mock,
    options.ready,
    options.failed,
    options.itemKey,
    options.transactionCount,
  ]);
};

export default useNeighborhoodDetailAnalytics;
