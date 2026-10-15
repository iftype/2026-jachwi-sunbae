import { afterEach, expect, it, vi } from 'vitest';

const { sdk } = vi.hoisted(() => ({
  sdk: { init: vi.fn(), capture: vi.fn(), captureException: vi.fn(), register: vi.fn() },
}));
vi.mock('posthog-js', () => ({ default: sdk }));

import { capturePostHogException } from '@/shared/lib/analytics/posthog';
import {
  initPostHog,
  resetPostHogClientForTests,
  setPostHogAuthenticationReader,
  trackPostHogEvent,
  trackPostHogOutboundEvent,
} from '@/shared/lib/analytics/posthog/runtime';

afterEach(() => {
  resetPostHogClientForTests();
  vi.resetAllMocks();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

it('SDK 로딩 중 로그인·로그아웃해도 각 이벤트 발생 당시 인증 상태를 보존한다', async () => {
  let loggedIn = false;
  setPostHogAuthenticationReader(() => (loggedIn ? 'authenticated' : 'anonymous'));
  initPostHog('phc_test', 'https://us.i.posthog.com');
  trackPostHogEvent('neighborhood_search_submitted', { auth_status: 'authenticated' });
  loggedIn = true;
  trackPostHogEvent('login_succeeded');
  trackPostHogOutboundEvent('landing_cta_clicked');
  capturePostHogException(new Error('safe'));
  loggedIn = false;
  trackPostHogEvent('landing_page_viewed');
  await vi.waitFor(() => expect(sdk.capture).toHaveBeenCalledTimes(4));
  expect(sdk.capture.mock.calls.map((call) => call[1].auth_status)).toEqual([
    'anonymous',
    'authenticated',
    'authenticated',
    'anonymous',
  ]);
  expect(sdk.captureException.mock.calls[0][1].auth_status).toBe('authenticated');
  const beforeSend = sdk.init.mock.calls[0][1].before_send;
  expect(
    beforeSend({ event: 'login_succeeded', properties: { auth_status: 'authenticated' } }).properties.auth_status,
  ).toBe('authenticated');
  expect(beforeSend({ event: '$autocapture', properties: {} }).properties.auth_status).toBe('anonymous');
});

it('로그인 직후 React 재렌더를 기다리지 않고 현재 인증 저장소 상태로 수집한다', async () => {
  let loggedIn = false;
  setPostHogAuthenticationReader(() => (loggedIn ? 'authenticated' : 'anonymous'));
  initPostHog('phc_test', 'https://us.i.posthog.com');
  await vi.waitFor(() => expect(sdk.init).toHaveBeenCalledOnce());
  loggedIn = true;
  trackPostHogEvent('login_succeeded');
  expect(sdk.capture).toHaveBeenCalledWith(
    'login_succeeded',
    expect.objectContaining({ auth_status: 'authenticated' }),
  );
  const beforeSend = sdk.init.mock.calls[0][1].before_send;
  expect(beforeSend({ event: '$rageclick', properties: {} }).properties.auth_status).toBe('authenticated');
});
it('대기 중 테스트 표시를 해제해도 기존 테스트 이벤트의 분류를 보존한다', async () => {
  setPostHogAuthenticationReader(() => 'anonymous');
  initPostHog('phc_test', 'https://us.i.posthog.com');
  window.history.replaceState(null, '', '/?analytics_test=1');
  trackPostHogEvent('landing_page_viewed');
  window.history.replaceState(null, '', '/?analytics_test=0');
  await vi.waitFor(() => expect(sdk.capture).toHaveBeenCalledOnce());
  const properties = sdk.capture.mock.calls[0][1];
  expect(properties.traffic_type).toBe('test');
  const beforeSend = sdk.init.mock.calls[0][1].before_send;
  expect(beforeSend({ event: 'landing_page_viewed', properties }).properties.traffic_type).toBe('test');
  expect(beforeSend({ event: '$pageview', properties: {} }).properties.traffic_type).toBe('external');
});
