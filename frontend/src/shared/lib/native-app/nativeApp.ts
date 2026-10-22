type NativeAppContext = {
  platform: string;
  version: number;
};

declare global {
  interface Window {
    __JACHWI_NATIVE_APP__?: NativeAppContext;
  }
}

export const isRunningInNativeApp = (): boolean =>
  typeof window !== 'undefined' &&
  (window.__JACHWI_NATIVE_APP__ !== undefined || navigator.userAgent.includes('JachwiSunbae/'));
