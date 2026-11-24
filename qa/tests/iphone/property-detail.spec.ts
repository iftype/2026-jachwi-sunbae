import { dismissGuide, expect, test } from '../../src/iphone';

// 매물 상세: 리스트에서 매물을 열어 정보 탭을 보고, 대표 사진을 크게 열어 넘긴 뒤 닫는다.
test('매물 상세: 정보 탭을 보고 사진을 크게 열어 넘기고 닫는다', async ({ page, shot }) => {
  await page.goto('/');
  await dismissGuide(page);
  await page
    .getByRole('navigation', { name: '하단 탭' })
    .getByRole('button', { name: /내 기록/ })
    .click();
  await page
    .getByRole('region', { name: '모든 기록' })
    .getByRole('link', { name: /신림역 원룸/ })
    .click();

  await expect(page).toHaveURL(/\/properties\/10$/);
  await expect(page.getByRole('heading', { level: 1, name: '신림역 원룸' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '정보' })).toHaveAttribute('aria-selected', 'true');
  const basics = page.getByRole('region', { name: '매물 기본 정보' });
  await expect(basics.getByRole('button', { name: /^보증금 \/ 월세 1,000만원 \/ 55만원/ })).toBeVisible();
  await expect(basics.getByRole('button', { name: /^주소 서울 관악구 신림로 12길 3/ })).toBeVisible();

  await page.getByRole('button', { name: '신림역 원룸 대표 사진 크게 보기' }).click();
  const viewer = page.getByRole('dialog', { name: '신림역 원룸 사진 크게 보기' });
  await expect(viewer.getByText('1 / 2')).toBeVisible();
  await viewer.getByRole('button', { name: '다음 사진' }).click();
  await expect(viewer.getByText('2 / 2')).toBeVisible();
  await expect(viewer.getByRole('img', { name: '신림역 원룸 사진 2' })).toBeVisible();
  await shot('property-detail-photo-viewer');

  await viewer.getByRole('button', { name: '사진 크게 보기 닫기' }).click();
  await expect(viewer).toBeHidden();
  await expect(page.getByRole('navigation', { name: '하단 탭' })).toBeHidden();
  await shot('property-detail-info');
});
