import { isRunningInNativeApp } from '@/shared/lib/native-app/nativeApp';

import type { PostHogSessionContext } from './types';
export const getPostHogPlatform = (): PostHogSessionContext['platform'] => {
  if (typeof navigator === 'undefined') return 'web';
  const nativePlatform = typeof window === 'undefined' ? undefined : window.__JACHWI_NATIVE_APP__?.platform;
  if (nativePlatform === 'ios') return 'ios_webview';
  if (nativePlatform === 'android') return 'android_webview';
  const userAgent = navigator.userAgent;
  if (/\bwv\b|; wv\)/i.test(userAgent)) return 'android_webview';
  if (isRunningInNativeApp() && /\bandroid\b/i.test(userAgent)) return 'android_webview';
  const isIos = /iPad|iPhone|iPod/i.test(userAgent);
  if (isIos && (isRunningInNativeApp() || !/CriOS|FxiOS|EdgiOS|Safari/i.test(userAgent))) return 'ios_webview';
  return 'web';
};
