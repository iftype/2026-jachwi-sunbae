import { dismissGuide, dragBy, expect, MAP_SDK_MODE, MAP_SKIP_REASON, test } from '../../src/iphone';

// 홈 지도: 매물 마커를 누르면 매물 카드 시트가 열리고, 끌어 올리고 내리며, 하단 탭으로 리스트와 다른 탭을 오간다.
test('홈 지도: 마커를 눌러 매물 카드 시트를 열고 끌며 하단 탭으로 오간다', async ({ page, shot }) => {
  test.skip(MAP_SDK_MODE === 'stub', MAP_SKIP_REASON);
  await page.goto('/');
  await dismissGuide(page);

  await page.getByRole('region', { name: '본 방 기록 지도' }).getByRole('button', { name: '망원동 투룸' }).click();
  const sheet = page.getByRole('region', { name: '선택한 매물' });
  await expect(sheet.getByRole('link', { name: /망원동 투룸/ })).toContainText('보증금 3,000만원 / 월세 75만원');
  await expect(sheet).toHaveAttribute('data-mode', 'default');

  const grabber = sheet.getByRole('button', { name: '상세 패널 높이 조절' });
  await dragBy(page, grabber, 0, -350);
  await expect(sheet).toHaveAttribute('data-mode', 'expanded');
  await shot('home-map-sheet-expanded');

  await dragBy(page, grabber, 0, 500);
  await expect(sheet).toHaveAttribute('data-mode', 'peek');

  const tabs = page.getByRole('navigation', { name: '하단 탭' });
  await tabs.getByRole('button', { name: /내 기록/ }).click();
  const records = page.getByRole('region', { name: '모든 기록' });
  await expect(records.getByRole('link', { name: /신림역 원룸/ })).toBeVisible();
  await expect(records.getByRole('link', { name: /망원동 투룸/ })).toBeVisible();
  await shot('home-list');

  await tabs.getByRole('button', { name: '동네 찾기' }).click();
  await expect(page).toHaveURL(/\/neighborhoods/);
  await tabs.getByRole('button', { name: '마이' }).click();
  await expect(page).toHaveURL(/\/me$/);
  await shot('home-tab-my');
});
