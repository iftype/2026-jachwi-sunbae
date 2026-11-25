import { dismissGuide, expect, test } from '../../src/iphone';

// 마이와 날씨: 하단 탭 `마이`로 들어가 `생활 날씨` 카드를 본다. 웹은 네이티브 푸시가 없어 알림을 켤 수 없으므로
// 카드는 `알림이 꺼져 있어요`와 `알림은 앱에서 받을 수 있어요.`를 보이고, 토글을 눌러도 설정 저장(PUT)을 보내지 않는다.
// 카드의 예보 그림(알림을 켠 뒤)은 앱(WebView)에서만 나와 여기서 검증하지 않는다.
// 웹에서 예보가 보이는 곳은 홈 리스트 머리의 날씨 안내다. 위치 권한이 있으면 예보(GET)가 200이고 `<동네> 날씨`에 기온이 뜬다.
test.use({ geolocation: { latitude: 37.5559, longitude: 126.9105 }, permissions: ['geolocation'] });

test('마이: 날씨 카드와 홈 머리 날씨를 본다', async ({ page, shot }) => {
  const puts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'PUT' && request.url().includes('/api/members/me/notification-settings')) puts.push(request.url());
  });
  await page.goto('/');
  await dismissGuide(page);
  await page.getByRole('navigation', { name: '하단 탭' }).getByRole('button', { name: '마이' }).click();

  await expect(page).toHaveURL(/\/me$/);
  const card = page.getByRole('region', { name: '생활 날씨' });
  await expect(card.getByText('알림이 꺼져 있어요')).toBeVisible();
  await expect(card.getByRole('status')).toHaveText('알림은 앱에서 받을 수 있어요.');
  const toggle = card.getByRole('switch', { name: '알림 받기' });
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  expect(puts).toEqual([]);
  await shot('my-weather-card');

  // 휴대폰 홈은 지도 보기로 열린다. 날씨 안내는 리스트 보기 머리에 있다.
  await page.getByRole('navigation', { name: '하단 탭' }).getByRole('button', { name: /내 기록/ }).click();
  const forecast = page.waitForResponse((response) => response.url().includes('/api/weather/forecasts'));
  await page.getByRole('button', { name: '리스트', exact: true }).click();
  expect((await forecast).status()).toBe(200);
  await expect(page.getByLabel('생활 날씨 안내').getByLabel(/날씨$/)).toContainText(/\d+°/);
  await shot('my-weather-header');
});
