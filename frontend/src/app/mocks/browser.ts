import { http, passthrough } from 'msw';
import { setupWorker } from 'msw/browser';

import { handlers } from './handlers';

const worker = setupWorker(...handlers);

export const startBrowserMocking = async () => {
  if (__COMMUTE_DATA_SOURCE__ === 'server') {
    worker.use(http.get('*/api/commute-areas/with-rents', () => passthrough()));
    worker.use(http.get('*/api/commute-areas/route', () => passthrough()));
  }
  await worker.start({
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
  });
};
