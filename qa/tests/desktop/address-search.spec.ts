import { dismissGuide, expect, test } from '../../src/iphone';

// 주소 검색(데스크탑): 데스크탑에는 /search 로 가는 링크가 없다(휴대폰 지도 머리의 `주소 검색`만 이 주소로 간다).
// 데스크탑 사용자는 홈 리스트 위 `주소 검색` 칸에서 같은 검색 API로 찾는다. 결과를 고르면 주소는 그대로 홈이다.
test('주소 검색: 홈 검색 칸에서 주소를 찾아 고른다', async ({ page, shot }) => {
  await page.goto('/');
  await dismissGuide(page);
  await expect(page.getByRole('link', { name: '주소 검색' })).toHaveCount(0);

  const search = page.waitForResponse((response) => response.url().includes('/api/maps/search'));
  await page.getByRole('textbox', { name: '주소 검색' }).fill('세종대로');
  expect((await search).status()).toBe(200);
  await page.getByRole('list', { name: '주소 검색 결과' }).getByRole('button', { name: /^서울 중구 세종대로 110/ }).click();
  await expect(page).not.toHaveURL(/\/search/);
  await expect(page.getByRole('list', { name: '주소 검색 결과' })).toHaveCount(0);
  await shot('address-search');
});
