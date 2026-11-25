import { dismissGuide, expect, test } from '../../src/iphone';

// 위치 선택(/map/select-location): 위치(좌표)가 없는 매물의 주소 칸에서 `지도에서 고르기`를 누르면 열린다.
// 목 매물은 모두 좌표가 있어, 이 경로만 매물 11(망원동 투룸)의 상세 응답에서 좌표를 비운다(예전에 주소만 저장된 기록과 같은 모양).
// 저장하기 직전에 비우기를 멈춘다. 저장한 뒤에는 실제로 좌표가 생기므로 그 응답을 그대로 본다.
// 주소를 찾아 고르고 `이 위치로 저장`을 누르면 위치 저장 요청이 성공하고 매물 상세로 돌아와 새 주소가 보인다.
// 목 서버는 한 번 띄우는 동안 상태를 기억한다. 매물 10은 매물 상세 경로가 주소를 보므로 건드리지 않는다.
test('위치 선택: 좌표 없는 매물의 위치를 지도 화면에서 고쳐 저장한다', async ({ page, shot }) => {
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

  await expect(page).toHaveURL(/\/map\/select-location$/);
  const stage = page.getByRole('region', { name: '매물 위치 선택 지도' });
  const search = page.waitForResponse((response) => response.url().includes('/api/maps/search'));
  await stage.getByRole('textbox', { name: '주소 검색' }).fill('세종대로');
  expect((await search).status()).toBe(200);
  await stage.getByRole('button', { name: /^서울 중구 세종대로 110/ }).click();
  await expect(stage.getByText('서울 중구 세종대로 110').first()).toBeVisible();

  const saved = page.waitForResponse(
    (response) => response.url().endsWith('/api/properties/11') && response.request().method() !== 'GET',
  );
  await page.unroute('**/api/properties/11');
  await stage.getByRole('button', { name: '이 위치로 저장' }).click();
  expect((await saved).ok()).toBe(true);
  await expect(page).toHaveURL(/\/properties\/11(\?|$)/);
  await expect(page.getByRole('button', { name: '주소 서울 중구 세종대로 110, 수정' })).toBeVisible();
  await shot('map-select-location');
});
