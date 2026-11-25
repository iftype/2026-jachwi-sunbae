import { expect, test } from '../../src/iphone';

// 체크리스트: 매물 상세의 체크리스트 탭에서 남은 항목을 `괜찮음`으로 고르면 위쪽 집계가 바로 바뀐다.
test('체크리스트: 항목을 체크하면 집계가 바뀐다', async ({ page, shot }) => {
  await page.goto('/properties/10');
  // 정보 탭이 다 뜬 뒤 탭을 옮긴다. 정보 탭을 불러오는 중에 옮기면 앱이 그 요청(메모, 주변 시설, 사진)을 일부러 취소하고,
  // 그 취소가 실패한 요청으로 잡혀 실행마다 결과가 달라졌다.
  await expect(page.getByRole('button', { name: /^주소 .*, 수정$/ })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.getByRole('tab', { name: '체크리스트' }).click();
  await expect(page).toHaveURL(/tab=checklist/);

  const summary = page.getByRole('list', { name: '체크리스트 진행 결과 집계' });
  const count = (label: string) => summary.getByRole('listitem').filter({ hasText: label }).getByRole('strong');
  await expect(count('괜찮음')).toHaveText('1');
  await expect(count('미확인')).toHaveText('1');
  await expect(page.getByRole('status').filter({ hasText: '3개 중 2개 평가' })).toBeVisible();

  const item = page.getByRole('group', { name: '주차가 가능한가요?' });
  const saved = page.waitForResponse(
    (response) => response.url().includes('/api/') && response.request().method() !== 'GET',
  );
  await item.getByRole('button', { name: '괜찮음' }).click();
  expect((await saved).ok()).toBe(true);

  await expect(item.getByRole('button', { name: '괜찮음' })).toHaveAttribute('aria-pressed', 'true');
  await expect(count('괜찮음')).toHaveText('2');
  await expect(count('미확인')).toHaveText('0');
  await expect(page.getByRole('status').filter({ hasText: '3개 중 3개 평가' })).toBeVisible();
  await shot('checklist');
});
