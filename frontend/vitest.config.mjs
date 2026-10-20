import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    // Stryker가 변이체를 돌리는 샌드박스 복사본은 본 테스트 실행에서 제외한다.
    exclude: [...configDefaults.exclude, '.stryker-tmp/**', 'reports/**'],
    restoreMocks: true,
    // 테스트 파일은 코어 수만큼 병렬로 실행한다. 직렬 실행보다 2~3배 빠르다.
    // 라우트 테스트 일부는 `waitFor` 대기 시간이 CPU 부하에 민감해 CI에서만 한 번 재시도한다.
    // 로컬은 재시도하지 않아 불안정한 테스트가 그대로 드러난다.
    retry: process.env.CI ? 1 : 0,
    // 워커를 스레드로 띄우면 파일마다 프로세스를 새로 띄우는 것보다 준비가 빠르다.
    pool: 'threads',
    testTimeout: 10_000,
  },
});
