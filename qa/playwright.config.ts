import { defineConfig, devices } from '@playwright/test';

import { qaConfig } from './src/config';

//DEV를 모바일 브라우저 환경으로 열어서 테스트를 하나씩 실행하고, 실패하면 재시도 없이 결과와 진단 자료를 남긴다.
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // 테스트마다 새 회원을 만들고 DEV를 공유하므로 한 번에 하나씩 실행한다.
  workers: 1, //테스트를 실행하는 작업 프로세스를 하나만 사용.
  fullyParallel: false,//같은 파일 안의 테스트까지 모두 병렬 실행하는 모드 X
  // 불안정한 결과를 재시도로 가리지 않고 그대로 드러낸다.
  retries: 0,//실패한 테스트 전체를 자동으로 다시 실행X.
  forbidOnly: Boolean(process.env.CI),
  reporter: [['list'], ['html', { open: 'never' }], ['./src/reporter.ts']],
    //결과를 두가지 형태로 동시에 출력
    //list - 터미널에 테스트별 진행상황과 성공 및 실패 표시
    //html - 브라우저에서 확인할 수 있는 HTML 라포트 생성
  use: {// 테스트 공통 상요할 브라우저 환경과 기록 옵션
    baseURL: qaConfig.baseUrl,
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    // 요소를 찾지 못할 때 테스트 전체 시간까지 기다리지 않고 원인을 바로 드러낸다.
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] }, // Playwright가 제공하는 기기별 브라우저 설정 모음.
    },
  ],
});
