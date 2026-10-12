export type PostHogClient = (typeof import('posthog-js'))['default'];
export type PostHogAction = (client: PostHogClient) => void;
export type PostHogErrorSeverity = 'P0' | 'P1' | 'P2';
export type PostHogErrorCategory = 'uncaught' | 'render' | 'api_server' | 'api_contract' | 'network' | 'chunk_load';
export type PostHogSessionContext = {
  environment: 'production' | 'development';
  app_version: string;
  platform: 'web' | 'ios_webview' | 'android_webview';
};
