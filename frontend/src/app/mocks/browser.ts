import { http, passthrough } from 'msw';
import { setupWorker } from 'msw/browser';

import { PUBLIC_PATH } from '@/shared/config/publicPath';

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
    serviceWorker: { url: `${PUBLIC_PATH}mockServiceWorker.js`, options: { scope: PUBLIC_PATH } },
  });
};
