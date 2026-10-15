import { afterEach, describe, expect, it, vi } from 'vitest';

import { getAnalyticsDeviceContext } from '@/shared/lib/analytics/deviceContext';

describe('이벤트 기기 구분', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete window.__JACHWI_NATIVE_APP__;
  });

  it('Safari 토큰이 있어도 앱 컨텍스트를 우선한다', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone Mobile Safari');
    window.__JACHWI_NATIVE_APP__ = { platform: 'ios', version: 2 };
    expect(getAnalyticsDeviceContext()).toMatchObject({ platform: 'ios_webview', device_category: 'mobile' });
  });

  it('일반 인앱 브라우저를 우리 앱으로 집계하지 않는다', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone Mobile Instagram');
    expect(getAnalyticsDeviceContext()).toMatchObject({ platform: 'web', operating_system: 'ios' });
  });
  it('Android의 일반 WebView·인스타 UA도 자취선배 앱으로 오분류하지 않는다', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Android Mobile; wv) Instagram');
    expect(getAnalyticsDeviceContext()).toMatchObject({ platform: 'web', operating_system: 'android' });
  });

  it('앱 UA에서 운영체제와 네이티브 버전을 구분한다', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Android Mobile wv JachwiSunbae/1.2.3 android');
    expect(getAnalyticsDeviceContext()).toMatchObject({ platform: 'android_webview', native_app_version: '1.2.3' });
  });

  it('데스크톱 형태의 UA를 사용하는 iPad도 태블릿 웹으로 구분한다', () => {
    vi.stubGlobal('navigator', { userAgent: 'Macintosh Safari', maxTouchPoints: 5 });
    expect(getAnalyticsDeviceContext()).toMatchObject({
      platform: 'web',
      device_category: 'tablet',
      operating_system: 'ios',
    });
  });
});
