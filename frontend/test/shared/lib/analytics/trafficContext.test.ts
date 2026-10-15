import { afterEach, expect, it, vi } from 'vitest';

import { getAnalyticsTrafficContext } from '@/shared/lib/analytics/trafficContext';

afterEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.restoreAllMocks();
});

it('테스트 링크를 한 번 열면 다음 페이지에도 테스트 기기로 분류한다', () => {
  window.history.replaceState(null, '', '/?analytics_test=1');
  expect(getAnalyticsTrafficContext('production').traffic_type).toBe('test');
  window.history.replaceState(null, '', '/map');
  expect(getAnalyticsTrafficContext('production').traffic_type).toBe('test');
  window.history.replaceState(null, '', '/?analytics_test=0');
  expect(getAnalyticsTrafficContext('production').traffic_type).toBe('external');
});

it('개발 환경은 계정 등록 없이도 제외할 수 있다', () => {
  expect(getAnalyticsTrafficContext('development').traffic_type).toBe('development');
});

it('저장소가 차단되어도 현재 테스트 링크의 트래픽은 외부 유저로 분류하지 않는다', () => {
  window.history.replaceState(null, '', '/?analytics_test=1');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('storage blocked');
  });
  expect(getAnalyticsTrafficContext('production').traffic_type).toBe('test');
});
