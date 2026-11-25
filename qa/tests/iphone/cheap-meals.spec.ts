import { dismissGuide, expect, test } from '../../src/iphone';

// 저렴한 한 끼: 마이의 바로가기로 들어가 식당, 편의점, 배달 탭을 차례로 연다. 탭마다 주소가 /cheap-meals/<탭>이고
// 그 탭의 목록 API가 200으로 답해 목록이 그려져야 한다. 목 응답은 frontend/src/app/mocks/handlers/mealHandlers.ts 다.
// 처음에는 첫 매물 자리로 가게를 찾다가 현재 위치를 받으면 그 자리로 다시 찾는다. 그때 앞 요청을 취소하는 것은 의도한 동작이라 판정에서 뺀다.
test.use({
  geolocation: { latitude: 37.5559, longitude: 126.9105 },
  permissions: ['geolocation'],
  expectedProblems: /^requestfailed .* http:\/\/localhost:\d+\/api\/maps\/good-price-stores\?/,
});

test('저렴한 한 끼: 식당, 편의점, 배달 탭 목록을 본다', async ({ page, shot }) => {
  await page.goto('/');
  await dismissGuide(page);
  await page.getByRole('navigation', { name: '하단 탭' }).getByRole('button', { name: '마이' }).click();
  // 현재 위치(위 geolocation) 기준 요청이 끝 상태다.
  const stores = page.waitForResponse((response) =>
    response.url().includes('/api/maps/good-price-stores?latitude=37.5559&longitude=126.9105'),
  );
  await page.getByRole('link', { name: '저렴한 한 끼' }).click();

  await expect(page).toHaveURL(/\/cheap-meals\/restaurant$/);
  expect((await stores).status()).toBe(200);
  const storeList = page.getByRole('list', { name: '가게 목록' });
  await expect(storeList.getByRole('button', { name: /^선배네 김밥 상세 보기/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: '착한가격 가게 2곳' })).toBeVisible();

  const promotions = page.waitForResponse((response) => response.url().includes('/api/promotions?brand=EMART24'));
  await page.getByRole('tab', { name: '편의점' }).click();
  await expect(page).toHaveURL(/\/cheap-meals\/convenience$/);
  expect((await promotions).status()).toBe(200);
  await expect(
    page.getByRole('list', { name: '행사상품 목록' }).getByRole('button', { name: /^참치마요 삼각김밥 상세 보기/ }),
  ).toBeVisible();

  const offers = page.waitForResponse((response) => response.url().includes('/api/delivery-discount-offers'));
  await page.getByRole('tab', { name: '배달' }).click();
  await expect(page).toHaveURL(/\/cheap-meals\/delivery$/);
  expect((await offers).status()).toBe(200);
  await expect(
    page.getByRole('list', { name: '배달 혜택 목록' }).getByRole('button', { name: /선배 치킨 할인 상세 보기/ }),
  ).toBeVisible();
  await shot('cheap-meals');
});
