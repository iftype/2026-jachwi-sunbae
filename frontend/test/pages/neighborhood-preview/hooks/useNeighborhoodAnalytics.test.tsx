import { renderHook } from '@testing-library/react';
import { type ReactNode, StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';

import useNeighborhoodAnalytics from '@/pages/neighborhood-preview/hooks/useNeighborhoodAnalytics';
import useNeighborhoodDetailAnalytics from '@/pages/neighborhood-preview/hooks/useNeighborhoodDetailAnalytics';
import { trackPostHogEvent } from '@/shared/lib/analytics/posthog';

vi.mock('@/shared/lib/analytics/posthog', () => ({ trackPostHogEvent: vi.fn() }));
beforeEach(() => vi.mocked(trackPostHogEvent).mockClear());
const wrapper = ({ children }: { children: ReactNode }) => (
  <StrictMode>
    <MemoryRouter initialEntries={['/explore/commute']}>{children}</MemoryRouter>
  </StrictMode>
);
const initial = {
  mode: 'commute' as const,
  mock: false,
  analyzing: false,
  fetching: false,
  success: false,
  error: false,
  resultCount: 0,
  transactionCount: 0,
};
const conditions = { maxMinutes: 30, maxTransfers: 1, maxRent: 0 };
const events = (name: string) => vi.mocked(trackPostHogEvent).mock.calls.filter(([event]) => event === name);

it('익명 공개 진입을 StrictMode에서도 한 번 수집하고 실제 검색 전 캐시 결과는 성공으로 세지 않는다', () => {
  const { rerender } = renderHook(useNeighborhoodAnalytics, { wrapper, initialProps: initial });
  expect(events('neighborhood_feature_viewed')).toHaveLength(1);
  rerender({ ...initial, success: true, resultCount: 3 });
  expect(events('neighborhood_search_results_viewed')).toHaveLength(0);
});

it('검색·빈 결과·재시도를 분리하고 재렌더·캐시 갱신은 검색 결과 수를 늘리지 않는다', () => {
  const { result, rerender } = renderHook(useNeighborhoodAnalytics, { wrapper, initialProps: initial });
  result.current.startSearch(conditions);
  rerender({ ...initial, analyzing: true, fetching: true });
  expect(events('neighborhood_search_results_viewed')).toHaveLength(0);
  rerender({ ...initial, analyzing: true, success: true });
  expect(events('neighborhood_search_results_viewed')).toHaveLength(1);
  expect(events('neighborhood_search_results_viewed')[0][1]).toEqual(
    expect.objectContaining({
      max_minutes: 30,
      max_transfers: 1,
      has_results: false,
      result_count: 0,
      mock_data: false,
    }),
  );
  rerender({ ...initial, analyzing: true, success: true, resultCount: 3 });
  expect(events('neighborhood_search_results_viewed')).toHaveLength(1);
  result.current.startSearch(conditions, 'retry');
  rerender({ ...initial, analyzing: true, error: true });
  expect(events('neighborhood_search_submitted')).toHaveLength(2);
  expect(events('neighborhood_search_failed')).toHaveLength(1);
  expect(events('neighborhood_search_results_viewed')).toHaveLength(1);
  const [first, second] = events('neighborhood_search_submitted');
  expect(first[1]?.search_id).not.toBe(second[1]?.search_id);
});

it('취소한 검색의 늦은 응답을 완료로 보내지 않는다', () => {
  const { result, rerender } = renderHook(useNeighborhoodAnalytics, { wrapper, initialProps: initial });
  result.current.startSearch(conditions);
  result.current.cancelSearch();
  rerender({ ...initial, analyzing: true, success: true, resultCount: 3 });
  expect(events('neighborhood_search_results_viewed')).toHaveLength(0);
});

it('검색 복원이나 상세 직접 진입도 기능 방문 분모에서 빠지지 않는다', () => {
  renderHook(useNeighborhoodAnalytics, {
    initialProps: initial,
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={['/explore/commute/areas/test/details']}>{children}</MemoryRouter>
    ),
  });
  expect(events('neighborhood_feature_viewed')).toHaveLength(1);
  expect(events('neighborhood_search_submitted')).toHaveLength(0);
});

it('월세 빈 목록은 열람 사실만 기록하고 거래정보 확인 완료와 구분한다', () => {
  const options = { feature: 'rental' as const, mock: false, ready: true, itemKey: 'area', transactionCount: 0 };
  const { rerender } = renderHook(useNeighborhoodDetailAnalytics, { wrapper, initialProps: options });
  expect(events('rental_information_viewed')).toHaveLength(1);
  expect(events('rental_information_viewed')[0][1]).toEqual(expect.objectContaining({ has_transactions: false }));
  rerender(options);
  expect(events('rental_information_viewed')).toHaveLength(1);
});

it('백그라운드 경로 응답은 완료로 수집하지 않고 경로가 표시된 경우만 수집한다', () => {
  const options = { feature: 'commute' as const, mock: true, ready: false, itemKey: 'area:station' };
  const { rerender } = renderHook(useNeighborhoodDetailAnalytics, { wrapper, initialProps: options });
  expect(events('commute_route_viewed')).toHaveLength(0);
  rerender({ ...options, ready: true });
  expect(events('commute_route_viewed')).toHaveLength(1);
  expect(events('commute_route_viewed')[0][1]).toEqual(expect.objectContaining({ mock_data: true }));
  rerender({ ...options, ready: true });
  expect(events('commute_route_viewed')).toHaveLength(1);
});
