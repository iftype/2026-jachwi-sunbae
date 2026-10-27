import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from '@/app/App';
import { preventPageZoom } from '@/shared/lib/page-zoom/preventPageZoom';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('React 루트 요소를 찾을 수 없습니다.');
}

preventPageZoom();

const startApplication = async () => {
  if (__ENABLE_MSW__) {
    const { startBrowserMocking } = await import('@/app/mocks/browser');
    await startBrowserMocking();
  }

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
};

void startApplication();
