import { dismissGuide, expect, test } from '../../src/iphone';

// 위치 선택(데스크탑): 데스크탑은 /map/select-location 으로 가지 않는다. 좌표 없는 매물의 `지도에서 고르기`를 누르면
// 옆의 본 방 기록 지도가 위치 고르기 상태(`지도를 눌러 새 위치를 고르세요.`)가 되고 주소는 매물 상세 그대로다.
// 목 매물은 모두 좌표가 있어, 이 경로만 매물 11(망원동 투룸)의 상세 응답에서 좌표를 비운다.
test('위치 선택: 데스크탑은 옆 지도에서 위치를 고른다', async ({ page, shot }) => {
  await page.route('**/api/properties/11', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const response = await route.fetch();
    const body = await response.json();
    body.data = { ...body.data, latitude: null, longitude: null };
    await route.fulfill({ response, json: body });
  });

  await page.goto('/properties/11');
  await dismissGuide(page);
  await page.getByRole('button', { name: /^주소 .*, 수정$/ }).click();
  await page.getByRole('button', { name: '지도에서 고르기' }).click();

  await expect(page.getByRole('status').filter({ hasText: '지도를 눌러 새 위치를 고르세요.' })).toBeVisible();
  await expect(page).toHaveURL(/\/properties\/11(\?|$)/);
  await shot('map-select-location');
});
