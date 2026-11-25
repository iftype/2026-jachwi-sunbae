import { dismissGuide, expect, test } from '../../src/iphone';

// 매물 사진: 매물 상세의 사진 칸에서 사진 관리(/properties/:id/photos)로 들어가 대표 사진을 바꾼다.
// 대표 지정 요청이 성공하고 고른 사진이 대표로 눌려야 한다. 목 서버는 상태를 기억하므로 끝에 대표를 처음 사진으로 되돌린다
// (매물 상세 경로가 같은 매물의 사진을 본다).
// 사진 올리기는 목이 일부러 501로 답한다(frontend/test/app/mocks/handlers.test.ts 의 `성공 응답으로 위장하지 않는다`).
// 올리기는 실제 저장소가 있어야 하므로 이 경로에서 검증하지 않는다.

test('매물 사진: 대표 사진을 바꾼다', async ({ page, shot }) => {
  await page.goto('/properties/10');
  await dismissGuide(page);
  await page.getByRole('link', { name: /사진/ }).first().click();

  await expect(page).toHaveURL(/\/properties\/10\/photos$/);
  const photos = page.getByRole('region', { name: '사진 관리' }).getByRole('listitem');
  await expect(photos).toHaveCount(2);
  await expect(page.getByRole('button', { name: '업로드 순 1번째 사진 대표 사진' })).toHaveAttribute('aria-pressed', 'true');

  const choose = async (order: number) => {
    const saved = page.waitForResponse((response) =>
      /\/api\/properties\/10\/photos\/\d+\/representative$/.test(response.url()),
    );
    await page.getByRole('button', { name: `업로드 순 ${order}번째 사진을 대표 사진으로 지정` }).click();
    expect((await saved).ok()).toBe(true);
    await expect(page.getByRole('button', { name: `업로드 순 ${order}번째 사진 대표 사진` })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  };
  await choose(2);
  await shot('property-photos');
  await choose(1);
});
