import { afterEach, describe, expect, it, vi } from 'vitest';

import { getPostHogPlatform } from '@/shared/lib/analytics/posthog/platform';
describe('PostHog 플랫폼 분류', () => {
  afterEach(() => {
    delete window.__JACHWI_NATIVE_APP__;
    vi.restoreAllMocks();
  });
  it.each(['ios', 'android'] as const)('앱 주입 정보 %s를 우선한다', (platform) => {
    window.__JACHWI_NATIVE_APP__ = { platform, version: 1 };
    expect(getPostHogPlatform()).toBe(`${platform}_webview`);
  });
  it('Safari 문자열이 있는 iOS 앱 전용 UA도 WebView로 분류한다', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone Safari JachwiSunbae/1.1.0 ios');
    expect(getPostHogPlatform()).toBe('ios_webview');
  });
  it('iOS Safari 브라우저는 웹으로 유지한다', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone Safari');
    expect(getPostHogPlatform()).toBe('web');
  });
});
