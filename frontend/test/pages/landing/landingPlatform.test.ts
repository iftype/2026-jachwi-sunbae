// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { getLandingMobilePlatform, LANDING_APP_URLS } from '@/pages/landing/lib/landingPlatform';

describe('랜딩 앱 추천 환경', () => {
  it('아이폰과 아이패드는 iOS로 구분한다', () => {
    expect(getLandingMobilePlatform('Mozilla/5.0 (iPhone)')).toBe('ios');
    expect(getLandingMobilePlatform('Mozilla/5.0 (Macintosh)', 5)).toBe('ios');
  });
  it('안드로이드는 별도로 구분한다', () => {
    expect(getLandingMobilePlatform('Mozilla/5.0 (Linux; Android 15)')).toBe('android');
    expect(LANDING_APP_URLS.android).toBe('https://play.google.com/store/apps/details?id=com.jachwisunbae');
  });
  it('PC 웹에서는 앱을 추천하지 않는다', () => {
    expect(getLandingMobilePlatform('Mozilla/5.0 (Macintosh)', 0)).toBeNull();
    expect(getLandingMobilePlatform('Mozilla/5.0 (Windows NT 10.0)')).toBeNull();
  });
});
