import { afterEach, describe, expect, it, vi } from 'vitest';
const { sdk } = vi.hoisted(() => ({
  sdk: {
    init: vi.fn(),
    identify: vi.fn(),
    register: vi.fn(),
    reset: vi.fn(),
    capture: vi.fn(),
    get_property: vi.fn(),
  },
}));
vi.mock('posthog-js', () => ({ default: sdk }));
import {
  identifyPostHogMember,
  initPostHog,
  resetPostHogForTests,
  resetPostHogIdentity,
  setPostHogSessionContext,
  trackPostHogEvent,
} from '@/shared/lib/analytics/posthog';
const context = { environment: 'development', app_version: '1.1.0', platform: 'web' } as const;
describe('PostHog 익명·회원 수명주기', () => {
  afterEach(() => {
    resetPostHogForTests();
    vi.resetAllMocks();
  });
  it('익명 첫 방문과 재마운트에서 ID를 reset하지 않는다', async () => {
    initPostHog('phc_test', 'https://us.i.posthog.com');
    setPostHogSessionContext(context);
    resetPostHogIdentity();
    trackPostHogEvent('login_page_viewed');
    await vi.waitFor(() => expect(sdk.capture).toHaveBeenCalledOnce());
    resetPostHogIdentity();
    expect(sdk.reset).not.toHaveBeenCalled();
  });
  it('SDK 로드 전에 로그인·로그아웃해도 순서대로 reset하고 공통 속성을 복원한다', async () => {
    initPostHog('phc_test', 'https://us.i.posthog.com');
    setPostHogSessionContext(context);
    identifyPostHogMember(13, '선배');
    resetPostHogIdentity();
    trackPostHogEvent('login_page_viewed');
    await vi.waitFor(() => expect(sdk.capture).toHaveBeenCalledOnce());
    expect(sdk.reset).toHaveBeenCalledOnce();
    expect(sdk.register).toHaveBeenCalledTimes(2);
    expect(sdk.register).toHaveBeenLastCalledWith(context);
    expect(sdk.identify.mock.invocationCallOrder[0]).toBeLessThan(sdk.reset.mock.invocationCallOrder[0]);
    expect(sdk.reset.mock.invocationCallOrder[0]).toBeLessThan(sdk.register.mock.invocationCallOrder[1]);
    expect(sdk.register.mock.invocationCallOrder[1]).toBeLessThan(sdk.capture.mock.invocationCallOrder[0]);
  });
  it('남아 있는 회원 식별은 비로그인 진입에서 제거한다', async () => {
    sdk.get_property.mockReturnValue('member-13');
    initPostHog('phc_test', 'https://us.i.posthog.com');
    setPostHogSessionContext(context);
    resetPostHogIdentity();
    await vi.waitFor(() => expect(sdk.reset).toHaveBeenCalledOnce());
    expect(sdk.get_property).toHaveBeenCalledWith('$user_id');
    expect(sdk.register).toHaveBeenLastCalledWith(context);
  });
  it('동일 회원 중복 식별은 생략하고 닉네임 변경은 반영한다', async () => {
    initPostHog('phc_test', 'https://us.i.posthog.com');
    identifyPostHogMember(13, '선배');
    identifyPostHogMember(13, '선배');
    identifyPostHogMember(13, '새 선배');
    await vi.waitFor(() => expect(sdk.identify).toHaveBeenCalledTimes(2));
  });
});
