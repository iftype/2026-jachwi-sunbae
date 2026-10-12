import { afterEach, describe, expect, it, vi } from 'vitest';
const { sdk } = vi.hoisted(() => ({ sdk: { init: vi.fn(), capture: vi.fn(), register: vi.fn() } }));
vi.mock('posthog-js', () => ({ default: sdk }));
import {
  getPostHogDiagnostics,
  initPostHog,
  resetPostHogClientForTests,
  runPostHogAction,
  setPostHogSessionContext,
  trackPostHogEvent,
} from '@/shared/lib/analytics/posthog/runtime';
describe('PostHog SDK 수명주기', () => {
  afterEach(() => {
    resetPostHogClientForTests();
    vi.resetAllMocks();
  });
  it('SDK가 준비되기 전에 들어온 액션을 순서대로 전송한다', async () => {
    initPostHog('phc_test', 'https://us.i.posthog.com');
    runPostHogAction((client) => client.capture('login_started'));
    runPostHogAction((client) => client.capture('login_succeeded'));
    await vi.waitFor(() => expect(sdk.capture).toHaveBeenCalledTimes(2));
    expect(sdk.capture.mock.calls.map(([name]) => name)).toEqual(['login_started', 'login_succeeded']);
  });
  it('한 액션이 실패해도 다음 액션을 보내고 제품에 예외를 전파하지 않는다', async () => {
    sdk.capture.mockImplementationOnce(() => {
      throw new Error('SDK error');
    });
    initPostHog('phc_test', 'https://us.i.posthog.com');
    runPostHogAction((client) => client.capture('login_started'));
    runPostHogAction((client) => client.capture('login_succeeded'));
    await vi.waitFor(() => expect(sdk.capture).toHaveBeenCalledTimes(2));
    sdk.capture.mockImplementationOnce(() => {
      throw new Error('SDK error');
    });
    expect(runPostHogAction((client) => client.capture('login_failed'))).toBe(false);
    expect(getPostHogDiagnostics().failedActions).toBe(2);
  });
  it('초기화 실패 후 큐를 보존하고 다음 액션에서 다시 초기화한다', async () => {
    sdk.init.mockImplementationOnce(() => {
      throw new Error('temporary failure');
    });
    initPostHog('phc_test', 'https://us.i.posthog.com');
    runPostHogAction((client) => client.capture('login_started'));
    await vi.waitFor(() => expect(sdk.init).toHaveBeenCalledOnce());
    expect(sdk.capture).not.toHaveBeenCalled();
    expect(getPostHogDiagnostics().status).toBe('failed');
    runPostHogAction((client) => client.capture('login_succeeded'));
    await vi.waitFor(() => expect(sdk.capture).toHaveBeenCalledTimes(2));
  });
  it('미설정 수집을 거절하고 준비 전 큐를 100개로 제한한다', () => {
    expect(runPostHogAction((client) => client.capture('login_started'))).toBe(false);
    initPostHog('phc_test', 'https://us.i.posthog.com');
    for (let i = 0; i < 100; i += 1) expect(runPostHogAction(() => undefined)).toBe(true);
    expect(runPostHogAction(() => undefined)).toBe(false);
    expect(getPostHogDiagnostics().droppedActions).toBe(1);
  });
  it('동일 설정 재초기화는 SDK를 중복 초기화하지 않는다', async () => {
    initPostHog('phc_test', 'https://us.i.posthog.com/');
    await vi.waitFor(() => expect(sdk.init).toHaveBeenCalledOnce());
    initPostHog('phc_test', 'https://us.i.posthog.com');
    expect(sdk.init).toHaveBeenCalledOnce();
  });
  it('기능 이벤트와 자동 수집에 공통 속성을 보강하고 임의 덮어쓰기를 막는다', async () => {
    initPostHog('phc_test', 'https://us.i.posthog.com');
    setPostHogSessionContext({ environment: 'development', app_version: '1.1.0', platform: 'web' });
    trackPostHogEvent('test_event', { environment: 'production' });
    await vi.waitFor(() => expect(sdk.capture).toHaveBeenCalledOnce());
    expect(sdk.capture).toHaveBeenCalledWith('test_event', {
      environment: 'development',
      app_version: '1.1.0',
      platform: 'web',
    });
    const beforeSend = sdk.init.mock.calls[0][1].before_send;
    expect(beforeSend({ event: '$rageclick', properties: {} }).properties).toEqual({
      environment: 'development',
      app_version: '1.1.0',
      platform: 'web',
    });
  });
});
