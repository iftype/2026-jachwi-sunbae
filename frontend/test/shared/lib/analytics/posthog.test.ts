import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockPostHog } = vi.hoisted(() => ({
  mockPostHog: {
    capture: vi.fn(),
    captureException: vi.fn(),
    register: vi.fn(),
    identify: vi.fn(),
    init: vi.fn(),
    opt_out_capturing: vi.fn(),
    reset: vi.fn(),
    get_property: vi.fn(),
  },
}));

vi.mock('posthog-js', () => ({ default: mockPostHog }));

import {
  capturePostHogException,
  identifyPostHogMember,
  initPostHog,
  isValidPostHogConfiguration,
  resetPostHogForTests,
  resetPostHogIdentity,
  setPostHogSessionContext,
  trackPostHogEvent,
  trackPostHogPageView,
} from '@/shared/lib/analytics/posthog';

describe('PostHog 제품 분석', () => {
  afterEach(() => {
    resetPostHogForTests();
    vi.clearAllMocks();
  });

  it('유효한 토큰과 호스트로 세션 녹화 및 마스킹과 함께 초기화한다', async () => {
    expect(isValidPostHogConfiguration('', 'https://us.i.posthog.com')).toBe(false);
    expect(isValidPostHogConfiguration('phc_test', 'not-a-url')).toBe(false);
    expect(initPostHog('phc_test', 'https://us.i.posthog.com')).toBe(true);

    await vi.waitFor(() => {
      expect(mockPostHog.init).toHaveBeenCalledWith('phc_test', {
        api_host: 'https://us.i.posthog.com',
        autocapture: true,
        capture_exceptions: {
          capture_unhandled_errors: true,
          capture_unhandled_rejections: true,
        },
        before_send: expect.any(Function),
        capture_pageview: false,
        disable_session_recording: false,
        mask_all_text: true,
        mask_all_element_attributes: true,
      });
    });
  });

  it('초기화 이후에만 페이지와 이벤트를 기록하고 같은 경로는 중복 기록하지 않는다', async () => {
    expect(trackPostHogPageView('/properties')).toBe(false);
    initPostHog('phc_test', 'https://us.i.posthog.com');

    expect(trackPostHogPageView('/properties')).toBe(true);
    expect(trackPostHogPageView('/properties')).toBe(false);
    expect(trackPostHogEvent('property_created', { count: 1 })).toBe(true);

    await vi.waitFor(() => {
      expect(mockPostHog.capture).toHaveBeenCalledWith('$pageview', { path: '/properties' });
      expect(mockPostHog.capture).toHaveBeenCalledWith('property_created', { count: 1 });
    });
  });

  it('예외를 Error Tracking 이벤트로 전송한다', async () => {
    const error = new Error('request failed');
    expect(capturePostHogException(error, { source: 'api_request' })).toBe(false);

    initPostHog('phc_test', 'https://us.i.posthog.com');
    expect(capturePostHogException(error, { source: 'api_request' })).toBe(true);

    await vi.waitFor(() => {
      expect(mockPostHog.captureException).toHaveBeenCalledWith(error, {
        source: 'api_request',
        error_category: 'uncaught',
        severity: 'P0',
      });
    });
  });

  it('라우트 경계가 P0로 보고해도 청크 오류는 P2로 낮추고 수집을 유지한다', async () => {
    const error = new Error('Loading chunk 961 failed.');
    error.name = 'ChunkLoadError';
    initPostHog('phc_test', 'https://us.i.posthog.com');
    expect(capturePostHogException(error, { boundary: 'lazy_route', severity: 'P0' })).toBe(true);
    await vi.waitFor(() => {
      expect(mockPostHog.captureException).toHaveBeenCalledWith(error, {
        boundary: 'lazy_route',
        error_category: 'chunk_load',
        severity: 'P2',
      });
    });
  });

  it('자동 수집된 청크 오류만 P2로 낮추고 다른 이벤트와 오류 등급은 유지한다', async () => {
    initPostHog('phc_test', 'https://us.i.posthog.com');
    await vi.waitFor(() => expect(mockPostHog.init).toHaveBeenCalledOnce());
    const beforeSend = mockPostHog.init.mock.calls[0][1].before_send;
    for (const exception of [
      { type: 'ChunkLoadError', value: 'Loading chunk 961 failed.' },
      { type: 'Error', value: 'Loading chunk 961 failed. (error: https://example.com/961.js)' },
      { type: 'Error', value: 'Loading CSS chunk 12 failed.' },
    ]) {
      expect(beforeSend({ event: '$exception', properties: { $exception_list: [exception], severity: 'P0' } })).toEqual(
        {
          event: '$exception',
          properties: { $exception_list: [exception], error_category: 'chunk_load', severity: 'P2' },
        },
      );
    }
    expect(beforeSend({ event: '$exception', properties: {} }).properties).toEqual({
      error_category: 'uncaught',
      severity: 'P0',
    });
    const serverError = { event: '$exception', properties: { error_category: 'api_server', severity: 'P1' } };
    expect(beforeSend(serverError)).toEqual(serverError);
    const pageview = { event: '$pageview', properties: {} };
    expect(beforeSend(pageview)).toEqual(pageview);
    expect(beforeSend(null)).toBeNull();
  });

  it('일반 화면 오류와 서버 오류는 수동 수집 등급을 유지한다', async () => {
    initPostHog('phc_test', 'https://us.i.posthog.com');
    for (const properties of [
      { error_category: 'render', severity: 'P0' },
      { error_category: 'api_server', severity: 'P1' },
    ]) {
      const error = new Error('서버 오류가 발생했습니다.');
      capturePostHogException(error, properties);
      await vi.waitFor(() => expect(mockPostHog.captureException).toHaveBeenCalledWith(error, properties));
    }
  });

  it('세션 환경과 버전 정보를 공통 속성으로 등록한다', async () => {
    initPostHog('phc_test', 'https://us.i.posthog.com');
    expect(
      setPostHogSessionContext({
        environment: 'production',
        app_version: '1.1.1',
        platform: 'ios_webview',
      }),
    ).toBe(true);

    await vi.waitFor(() => {
      expect(mockPostHog.register).toHaveBeenCalledWith({
        environment: 'production',
        app_version: '1.1.1',
        platform: 'ios_webview',
      });
    });
  });

  it('회원 식별과 초기화를 수행한다', async () => {
    expect(identifyPostHogMember(12, '자취선배1')).toBe(false);
    initPostHog('phc_test', 'https://us.i.posthog.com');

    expect(identifyPostHogMember(12, '자취선배1')).toBe(true);
    await vi.waitFor(() => {
      expect(mockPostHog.identify).toHaveBeenCalledWith('member-12', {
        name: '자취선배1',
        nickname: '자취선배1',
      });
    });

    resetPostHogIdentity();
    await vi.waitFor(() => expect(mockPostHog.reset).toHaveBeenCalledOnce());
  });
});
