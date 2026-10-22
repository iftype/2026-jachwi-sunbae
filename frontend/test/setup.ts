import '@testing-library/jest-dom/vitest';

import { cleanup, configure } from '@testing-library/react';
import { webcrypto } from 'node:crypto';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

import { resetAuthenticationForTests } from '@/features/auth/model/authStore';

import { server } from './server';

configure({ asyncUtilTimeout: 5_000 });

Object.defineProperty(globalThis, 'crypto', {
  configurable: true,
  value: webcrypto,
});

// 파일 맨 위에 `// @vitest-environment node`를 둔 테스트는 DOM이 없다. jsdom 준비를 건너뛰어 더 빨리 끝난다.
const hasDom = typeof window !== 'undefined';

if (hasDom) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });

  let objectUrlSequence = 0;
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => `blob:test-photo-${objectUrlSequence++}`),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  });

  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: vi.fn(),
  });

  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };

  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  if (hasDom) cleanup();
  server.resetHandlers();
  resetAuthenticationForTests();
  if (!hasDom) return;
  window.sessionStorage.clear();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.mocked(URL.createObjectURL).mockClear();
  vi.mocked(URL.revokeObjectURL).mockClear();
  vi.mocked(HTMLMediaElement.prototype.play).mockClear();
  vi.mocked(HTMLMediaElement.prototype.pause).mockClear();
});

afterAll(() => server.close());
