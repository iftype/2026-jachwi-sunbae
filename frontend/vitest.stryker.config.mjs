import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';

import baseConfig from './vitest.config.mjs';

// 뮤테이션 테스트는 기능 규칙이 담긴 로직 테스트만 돌린다.
// 화면 통합(router)과 UI 컴포넌트 테스트는 변이 하나마다 jsdom 전체를 다시 세워야 해서 느리고,
// UI 구조가 바뀌면 함께 바뀌는 테스트라 뮤테이션 점수의 기준으로 삼지 않는다.
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['test/**/{api,lib,model,hooks}/**/*.test.{ts,tsx}', 'test/pages/**/*.test.ts'],
      exclude: [...configDefaults.exclude, '.stryker-tmp/**', 'reports/**', 'test/**/ui/**'],
    },
  }),
);
