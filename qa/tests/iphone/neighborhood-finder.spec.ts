import { dismissGuide, dragBy, expect, MAP_SDK_MODE, MAP_SKIP_REASON, test } from '../../src/iphone';

// 동네 찾기: 출퇴근 장소를 입력해 고르고 찾으면 결과 동네가 지도에 붙고, 동네를 누르면 아래 시트가 열린다. 시트는 끌어 내려 닫는다.
test('동네 찾기: 출퇴근 장소를 입력해 찾으면 결과 동네가 나오고 동네 시트를 열고 끌어 닫는다', async ({
  page,
  shot,
}) => {
  test.skip(MAP_SDK_MODE === 'stub', MAP_SKIP_REASON);
  await page.goto('/explore');
  await dismissGuide(page);

  await page.getByRole('textbox', { name: '출퇴근 장소' }).fill('시청');
  await page.getByRole('list', { name: '주소 검색 결과' }).getByRole('button').first().click();
  const search = page.getByRole('button', { name: /에서 찾기$/ });
  await expect(search).toBeEnabled();

  const results = page.waitForResponse((response) => response.url().includes('/api/commute-areas/with-rents'));
  await search.click();
  const response = await results;
  expect(response.status()).toBe(200);
  const query = new URL(response.url()).searchParams;
  expect(query.get('maxMinutes')).toBe('40');
  expect(query.get('maxTransfers')).toBe('1');

  const areas = page.getByRole('region', { name: '행정동 프리셋 지도' }).getByRole('button', { name: /통근 \d+분/ });
  await expect(areas).toHaveCount(3);
  await expect(page.getByRole('button', { name: '출퇴근 장소 다시 선택' })).toBeVisible();

  // 목 데이터의 동네는 목적지(시청)와 멀어 처음에는 화면 밖에 있다. Playwright가 뱃지를 화면 안으로 옮겨 누른다.
  await areas.filter({ hasText: '역삼1동' }).click();
  await expect(page).toHaveURL(/\/explore\/areas\/\d+$/);
  const sheet = page.getByRole('region', { name: '역삼1동' });
  await expect(sheet.getByRole('definition').first()).toHaveText(/3분\s*역삼역에서 출발/);
  await expect(sheet.getByRole('definition').nth(1)).toHaveText('68 / 1,000');
  await expect(sheet).toHaveAttribute('data-mode', 'default');

  await shot('neighborhood-finder');

  // 동네 시트는 처음 높이가 끝이라 위로 끌어도 그대로이고(maxMode default), 아래로 끌어 내리면 닫힌다. 고른 동네는 남는다.
  const grabber = sheet.getByRole('button', { name: '상세 패널 높이 조절' });
  await dragBy(page, grabber, 0, -300);
  await expect(sheet).toHaveAttribute('data-mode', 'default');
  await dragBy(page, grabber, 0, 400);
  await expect(sheet).toBeHidden();
  await expect(areas.filter({ hasText: '역삼1동' })).toHaveAttribute('aria-pressed', 'true');
  await shot('neighborhood-finder-sheet-closed');
});
