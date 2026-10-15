import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    restoreMocks: true,
    fileParallelism: false,
    // 워커를 스레드로 띄우면 파일마다 프로세스를 새로 띄우는 것보다 준비가 빠르다.
    pool: 'threads',
    testTimeout: 10_000,
  },
});
