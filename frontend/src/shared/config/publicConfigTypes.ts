export type PublicConfig = {
  apiBaseUrl: string;
  commuteDataSource?: 'mock' | 'server';
  boundaryBaseUrl?: string;
  mapProviderMode?: 'demo' | 'naver';
  naverMapClientId?: string;
  posthogProjectToken?: string;
  posthogHost?: string;
  appVersion?: string;
  appEnvironment?: 'production' | 'development';
};
