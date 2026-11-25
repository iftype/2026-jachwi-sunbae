import { expect, test } from '../../src/iphone';

// 익명 자동 로그인: 처음 여는 브라우저는 POST /api/auth/login 으로 익명 회원을 받고, 그 토큰을 단 요청으로 목록을 불러온다.
test('인증: 처음 열면 익명 회원으로 자동 로그인한다', async ({ page }) => {
  const login = page.waitForResponse((response) => response.url().endsWith('/api/auth/login'));
  const list = page.waitForRequest(
    (request) => request.url().endsWith('/api/properties') && request.method() === 'GET',
  );
  await page.goto('/');
  expect((await login).status()).toBe(200);
  expect(await (await list).headerValue('authorization')).toBe('Bearer local-msw-access-token-1');
  // 매물 두 개를 받아 `기록한 동네`에 전체 2가 보인다(지도 SDK와 무관한 요소).
  await expect(page.getByRole('navigation', { name: '기록한 동네' }).getByRole('button', { name: '전체2' })).toBeVisible();
});

// 401 토큰 갱신: Access Token이 만료돼 목록 요청이 401을 받으면 POST /api/auth/refresh 로 새 토큰을 받아 같은 요청을 한 번 다시 보낸다.
// 목은 토큰 만료를 흉내 내지 않으므로 첫 목록 응답만 네트워크에서 401로 바꾼다(앱 코드는 건드리지 않는다).
test.describe(() => {
  // 일부러 낸 401 응답과 그 콘솔 줄만 판정에서 뺀다. 다른 문제는 그대로 실패다.
  test.use({ expectedProblems: /^(http 401|console .*401.*) http:\/\/localhost:\d+\/api\/properties$/ });

test('인증: 401을 받으면 토큰을 갱신해 다시 요청한다', async ({ page }) => {
  let expired = false;
  await page.route('**/api/properties', async (route) => {
    if (expired || route.request().method() !== 'GET') return route.fallback();
    expired = true;
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'ACCESS_TOKEN_EXPIRED', message: '만료', errors: [] }),
    });
  });
  const calls: string[] = [];
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname;
    if (['/api/auth/login', '/api/auth/refresh', '/api/properties'].includes(path))
      calls.push(`${response.request().method()} ${path} ${response.status()}`);
  });

  await page.goto('/');
  // 매물 두 개를 받아 `기록한 동네`에 전체 2가 보인다(지도 SDK와 무관한 요소).
  await expect(page.getByRole('navigation', { name: '기록한 동네' }).getByRole('button', { name: '전체2' })).toBeVisible();
  expect(calls).toEqual([
    'POST /api/auth/login 200',
    'GET /api/properties 401',
    'POST /api/auth/refresh 200',
    'GET /api/properties 200',
  ]);
});
});
