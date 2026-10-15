import '@/shared/lib/native-app/nativeApp';

export const getAnalyticsDeviceContext = () => {
  const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const nativePlatform = typeof window === 'undefined' ? undefined : window.__JACHWI_NATIVE_APP__?.platform;
  const appSignature = /JachwiSunbae\/([^\s]+)\s+(ios|android)/i.exec(userAgent);
  const platform = nativePlatform ?? appSignature?.[2]?.toLowerCase();
  const isIpad =
    /iPad/i.test(userAgent) ||
    (typeof navigator !== 'undefined' && /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1);
  const isIos = isIpad || /iPhone|iPod/i.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);
  return {
    platform:
      platform === 'ios'
        ? ('ios_webview' as const)
        : platform === 'android'
          ? ('android_webview' as const)
          : ('web' as const),
    device_category:
      isIpad || /Tablet/i.test(userAgent) || (isAndroid && !/Mobile/i.test(userAgent))
        ? 'tablet'
        : /Mobile|iPhone|iPod/i.test(userAgent)
          ? 'mobile'
          : 'desktop',
    operating_system: isIos || platform === 'ios' ? 'ios' : isAndroid || platform === 'android' ? 'android' : 'other',
    native_app_version: appSignature?.[1] ?? null,
  };
};
