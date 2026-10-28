import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import { trackPostHogEvent } from '@/shared/lib/analytics/posthog';

type SearchConditions = { maxMinutes: number; maxTransfers: number; maxRent: number };
type AnalyticsOptions = {
  mock: boolean;
  analyzing: boolean;
  fetching: boolean;
  success: boolean;
  error: boolean;
  resultCount: number;
  /** 결과 중 월세 시세가 있는 동네 수. */
  rentCount: number;
};
// 통근과 월세를 한 화면에서 함께 찾으므로 기능은 통근 탐색 하나다. 월세 조건은 같은 검색의 속성으로 남긴다.
const feature = 'commute';
const conditionProperties = (conditions: SearchConditions) => ({
  max_minutes: conditions.maxMinutes,
  max_transfers: conditions.maxTransfers,
  max_rent_manwon: conditions.maxRent,
});

/** 표시된 검색 결과만 측정하며 캐시 갱신·StrictMode로 검색 횟수를 늘리지 않는다. */
const useNeighborhoodAnalytics = (options: AnalyticsOptions) => {
  const location = useLocation();
  const visit = useRef<string | null>(null);
  const search = useRef<{ id: string; finished: boolean; conditions: SearchConditions } | null>(null);
  const entrypoint =
    location.pathname === '/explore' || location.pathname.startsWith('/explore/') ? 'public_explore' : 'neighborhoods';
  const context = { feature, entrypoint, mock_data: options.mock };

  useEffect(() => {
    // 지도에서 상세로 이동할 때는 재집계하지 않고 상세로 직접 들어온 방문은 포함한다.
    if (/\/areas\//.test(location.pathname) && visit.current !== null) return;
    const key = `${location.key}:${feature}`;
    if (visit.current === key) return;
    visit.current = key;
    trackPostHogEvent('neighborhood_feature_viewed', { feature, entrypoint, mock_data: options.mock });
  }, [location.key, location.pathname, entrypoint, options.mock]);

  useEffect(() => {
    const attempt = search.current;
    if (!attempt || attempt.finished || !options.analyzing || options.fetching) return;
    if (!options.success && !options.error) return;
    attempt.finished = true;
    trackPostHogEvent(options.error ? 'neighborhood_search_failed' : 'neighborhood_search_results_viewed', {
      feature,
      entrypoint,
      mock_data: options.mock,
      search_id: attempt.id,
      ...conditionProperties(attempt.conditions),
      ...(options.error
        ? { error_kind: 'request' }
        : {
            result_count: options.resultCount,
            has_results: options.resultCount > 0,
            rent_area_count: options.rentCount,
          }),
    });
  }, [
    options.analyzing,
    options.fetching,
    options.success,
    options.error,
    options.resultCount,
    options.rentCount,
    entrypoint,
    options.mock,
  ]);

  const capture = (event: string, properties: Record<string, unknown> = {}) =>
    trackPostHogEvent(event, {
      ...context,
      ...(search.current ? { search_id: search.current.id } : {}),
      ...properties,
    });

  return {
    startSearch: (conditions: SearchConditions, trigger: 'search' | 'retry' = 'search') => {
      search.current = { id: crypto.randomUUID(), finished: false, conditions };
      capture('neighborhood_search_submitted', { trigger, ...conditionProperties(conditions) });
    },
    cancelSearch: () => {
      search.current = null;
    },
    selectArea: () => capture('neighborhood_area_selected'),
    changeStation: () => capture('commute_departure_station_changed'),
    openListing: () => capture('neighborhood_listing_link_clicked', { provider: 'dabang' }),
  };
};

export default useNeighborhoodAnalytics;
