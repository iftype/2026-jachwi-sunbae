import { expect, test } from '../src/fixtures';

// 실행 환경 점검용이다. 제품 동작 판정은 Scenario 테스트가 한다.
test('새 회원으로 시작하면 매물 목록에 도착한다', async ({ page, member }) => {
  await expect(page).toHaveURL(/\/properties$/);
  await expect(page.getByRole('heading', { name: '내 매물' })).toBeAttached();
  expect(member.nickname).toMatch(/^qa-\d{6}-\d{6}$/);
});
