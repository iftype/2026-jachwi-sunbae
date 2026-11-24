import { dismissGuide, expect, test } from '../../src/iphone';

// 방 비교: 리스트의 `비교하고 PDF로 받기`로 /compare 에 들어가 매물 둘을 고르고 비교 PDF를 받는다.
// 지금 /compare 는 비교 표 대신 고른 매물을 PDF 한 장으로 받는 화면이다.
test('방 비교: 매물 둘을 골라 비교 PDF를 받는다', async ({ page, shot }) => {
  await page.goto('/');
  await dismissGuide(page);
  await page
    .getByRole('navigation', { name: '하단 탭' })
    .getByRole('button', { name: /내 기록/ })
    .click();
  await page.getByRole('link', { name: '기록 비교하고 PDF로 받기' }).click();

  await expect(page).toHaveURL(/\/compare$/);
  const list = page.getByRole('list', { name: '비교할 매물 목록' });
  await expect(list.getByRole('checkbox')).toHaveCount(2);
  await list.getByRole('checkbox', { name: /^망원동 투룸/ }).check();
  await list.getByRole('checkbox', { name: /^신림역 원룸/ }).check();
  await expect(page.getByText('2개 매물의 모든 기록을 PDF로 만들어요.')).toBeVisible();

  const pdf = page.waitForResponse((response) => response.url().includes('/api/properties/export.pdf'));
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '선택한 2개 PDF 받기' }).click();
  expect((await pdf).status()).toBe(200);
  expect((await download).suggestedFilename()).toMatch(/^jachwi-sunbae-property-comparison-.*\.pdf$/);
  // 만드는 동안 버튼이 `PDF 만드는 중`으로 바뀐다. 끝나면 다시 받을 수 있는 상태로 돌아온다.
  await expect(page.getByRole('button', { name: '선택한 2개 PDF 받기' })).toBeEnabled();
  await shot('compare');
});
