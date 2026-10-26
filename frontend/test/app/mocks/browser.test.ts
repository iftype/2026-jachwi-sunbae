// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { startBrowserMocking } from '@/app/mocks/browser';
import { clearAuthentication, getAccessToken, setAuthentication } from '@/features/auth/model/authStore';

const { start } = vi.hoisted(() => ({ start: vi.fn().mockResolvedValue(undefined) }));
vi.mock('msw/browser', () => ({ setupWorker: () => ({ start, use: vi.fn() }) }));
beforeEach(() => vi.stubGlobal('__COMMUTE_DATA_SOURCE__', 'mock'));
afterEach(() => vi.unstubAllGlobals());
it('MSW 시작만으로는 로그인하지 않는다', async () => {
  await startBrowserMocking();
  expect(start).toHaveBeenCalled();
  expect(getAccessToken()).toBeNull();
});
it('정상 로그인은 유지하지만 로그아웃 후 MSW를 다시 시작해도 토큰을 만들지 않는다', async () => {
  setAuthentication({ accessToken: 'nickname-login-token', tokenType: 'Bearer', expiresIn: 60 });
  await startBrowserMocking();
  expect(getAccessToken()).toBe('nickname-login-token');
  clearAuthentication('unauthorized');
  await startBrowserMocking();
  expect(getAccessToken()).toBeNull();
});
