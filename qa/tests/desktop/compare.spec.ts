import { dismissGuide, expect, test } from '../../src/iphone';

// 방 비교(데스크탑): 왼쪽 `화면 이동`의 `방 비교`로 /compare 에 들어가 매물 둘을 고르고 비교 PDF를 받는다.
// 데스크탑은 매물을 고르면 옆에 그 매물 미리 보기를 열고 상세를 불러온다. 다음 매물을 고르면 앞 미리 보기 요청을 취소하는데,
// 의도한 동작이라 판정에서 뺀다.
test.use({ expectedProblems: /^requestfailed net::ERR_ABORTED http:\/\/localhost:\d+\/api\/properties\/\d+$/ });
test('방 비교: 매물 둘을 골라 비교 PDF를 받는다', async ({ page, shot }) => {
  await page.goto('/');
  await dismissGuide(page);
  await page.getByRole('navigation', { name: '화면 이동' }).getByRole('button', { name: '방 비교' }).click();

  await expect(page).toHaveURL(/\/compare$/);
  await expect(page.getByRole('heading', { name: '비교할 매물 선택' })).toBeAttached();
  const list = page.getByRole('list', { name: '비교할 매물 목록' });
  await expect(list.getByRole('checkbox')).toHaveCount(2);
  await list.getByRole('checkbox', { name: /^망원동 투룸/ }).check();
  await list.getByRole('checkbox', { name: /^신림역 원룸/ }).check();
  await expect(page.getByText('2개 선택')).toBeVisible();

  const pdf = page.waitForResponse((response) => response.url().includes('/api/properties/export.pdf'));
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '선택한 2개 PDF 받기' }).click();
  expect((await pdf).status()).toBe(200);
  expect((await download).suggestedFilename()).toMatch(/^jachwi-sunbae-property-comparison-.*\.pdf$/);
  await expect(page.getByRole('button', { name: '선택한 2개 PDF 받기' })).toBeEnabled();
  await shot('compare');
});
