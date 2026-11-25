import { dismissGuide, expect, test } from '../../src/iphone';

// 주소 검색: 홈 머리의 `주소 검색`으로 /search 에 들어가 주소를 찾고 결과를 고른다. 입력하는 대로 검색 API가 200으로 답해
// `주소 검색 결과`가 뜨고, 결과를 고르면 홈 지도로 돌아온다.
test('주소 검색: 주소를 찾아 고르면 홈 지도로 돌아온다', async ({ page, shot }) => {
  await page.goto('/');
  await dismissGuide(page);
  await page.getByRole('link', { name: '주소 검색' }).click();

  await expect(page).toHaveURL(/\/search$/);
  await expect(page.getByRole('region', { name: '내 기록' }).getByRole('button')).toHaveCount(2);
  const search = page.waitForResponse((response) => response.url().includes('/api/maps/search'));
  await page.getByRole('textbox', { name: '주소 검색' }).fill('세종대로');
  expect((await search).status()).toBe(200);

  await page.getByRole('list', { name: '주소 검색 결과' }).getByRole('button', { name: /^서울 중구 세종대로 110/ }).click();
  await expect(page).toHaveURL(/\/$|\/\?/);
  await shot('address-search');
});
