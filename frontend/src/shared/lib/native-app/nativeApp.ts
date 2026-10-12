/** 앱이 웹에 알려 주는 네이티브 기능. 구버전 앱은 목록이 없거나 비어 있다. */
export type NativeAppFeature = 'tab-bar' | 'tab-bar-overlay';

type NativeAppContext = {
  platform: string;
  version: number;
  features?: readonly NativeAppFeature[];
};

declare global {
  interface Window {
    __JACHWI_NATIVE_APP__?: NativeAppContext;
    ReactNativeWebView?: { postMessage: (message: string) => void };
  }
}

export const isRunningInNativeApp = (): boolean =>
  typeof window !== 'undefined' &&
  (window.__JACHWI_NATIVE_APP__ !== undefined || navigator.userAgent.includes('JachwiSunbae/'));

export const hasNativeAppFeature = (feature: NativeAppFeature): boolean =>
  typeof window !== 'undefined' && window.__JACHWI_NATIVE_APP__?.features?.includes(feature) === true;

/** 앱 셸에 JSON 메시지를 보낸다. 브라우저에서는 아무것도 하지 않는다. */
export const postNativeAppMessage = (message: { type: string } & Record<string, unknown>): void => {
  window.ReactNativeWebView?.postMessage(JSON.stringify(message));
};
