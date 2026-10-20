// @ts-check
/**
 * 뮤테이션 테스트 대상은 기능 규칙이 담긴 로직 파일이다. 실행 방법과 제외 근거는 docs/mutation-testing.md에 있다.
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
const config = {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.stryker.config.mjs' },
  mutate: [
    'src/**/{api,lib,model,hooks}/**/*.ts',
    // 요청·응답 형태만 선언하는 파일이라 변이가 동작을 바꾸지 않는다.
    '!src/**/dtos/**',
    '!src/**/*.d.ts',
    // 오류 문구와 쿼리 키 상수는 문자열 변이가 전부 살아남지만 잡을 가치가 없다.
    '!src/**/*ErrorMessages.ts',
    '!src/**/*QueryKeys.ts',
    // 앱 조립, 목 서버, 공용 UI는 로직 테스트가 아닌 통합·컴포넌트 테스트가 지킨다.
    '!src/app/**',
    '!src/shared/ui/**',
  ],
  coverageAnalysis: 'perTest',
  incremental: true,
  incrementalFile: 'reports/mutation/incremental.json',
  reporters: ['clear-text', 'progress', 'html'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  clearTextReporter: { allowColor: false, logTests: false, reportTests: false },
  // 점수는 KPI가 아니라 리뷰 입력이다. break를 두지 않고 살아남은 변이 목록으로 테스트를 보강한다.
  thresholds: { high: 80, low: 60, break: null },
  tempDirName: '.stryker-tmp',
  cleanTempDir: 'always',
};

export default config;
