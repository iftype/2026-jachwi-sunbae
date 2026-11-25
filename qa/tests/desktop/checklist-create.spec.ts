import { dismissGuide, expect, test } from '../../src/iphone';

// 새 체크리스트: 체크리스트 관리(/checklists)의 `새 체크리스트`로 /checklists/new 에 들어가 제공 항목 둘을 골라 저장한다.
// 저장 요청이 성공하고, 내 체크리스트가 하나 늘어야 한다.
test('새 체크리스트: 제공 항목 둘을 골라 저장한다', async ({ page, shot }) => {
  await page.goto('/checklists');
  await dismissGuide(page);
  await expect(page.getByRole('heading', { name: /내 체크리스트 2개/ })).toBeVisible();
  await page.getByRole('link', { name: '새 체크리스트' }).click();

  await expect(page).toHaveURL(/\/checklists\/new$/);
  await page.getByRole('checkbox', { name: '주차가 가능한가요?' }).check();
  await page.getByRole('checkbox', { name: '채광이 충분한가요?' }).check();
  await page.getByRole('button', { name: '선택한 2개 항목 추가' }).click();

  await page.getByRole('textbox', { name: '체크리스트 이름' }).fill('주차와 채광');
  const created = page.waitForResponse(
    (response) => response.url().endsWith('/api/checklists') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: '체크리스트 저장' }).click();
  expect((await created).ok()).toBe(true);

  await expect(page).toHaveURL(/\/checklists$/);
  await expect(page.getByRole('heading', { name: /내 체크리스트 3개/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /^주차와 채광 2개 항목/ })).toBeVisible();
  await shot('checklist-create');
});
