import { http, passthrough } from 'msw';
import { setupWorker } from 'msw/browser';

import { setAuthentication } from '@/features/auth/model/authStore';

import { handlers } from './handlers';

const worker = setupWorker(...handlers);

export const startBrowserMocking = async () => {
  if (__COMMUTE_DATA_SOURCE__ === 'server') {
    worker.use(http.get('*/api/commute-areas', () => passthrough()));
    worker.use(http.get('*/api/commute-areas/route', () => passthrough()));
    worker.use(http.get('*/api/rental-transactions', () => passthrough()));
  }
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
  });

  setAuthentication({
    accessToken: 'local-msw-access-token',
    tokenType: 'Bearer',
    expiresIn: 60 * 60 * 8,
  });
};
