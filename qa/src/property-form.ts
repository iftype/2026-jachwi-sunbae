import { expect, type Locator, type Page, type Response, test } from '@playwright/test';

import { isApiResponse } from './api';

// 매물 등록 화면(F02)의 입력란과 조작. 여러 Scenario가 같은 화면을 쓰므로 선택자를 한곳에 둔다.

export const propertyForm = (page: Page) => ({
  deposit: page.getByLabel('보증금 입력'),
  monthlyRent: page.getByLabel('월세 입력'),
  name: page.getByLabel('매물 이름 입력'),
  next: page.getByRole('button', { name: '다음' }),
  submit: page.getByRole('button', { name: '매물 등록' }),
  close: page.getByRole('link', { name: '매물 등록 닫기' }),
});

/** 빈 매물 목록에서 매물 등록 화면을 연다. */
export const openCreateFormFromEmptyList = async (page: Page): Promise<void> => {
  await page.getByRole('link', { name: '첫 매물 등록하기' }).click();
  await expect(page).toHaveURL(/\/properties\/new$/);
};

export type PropertyInput = { name: string; depositManwon: number; monthlyRentManwon: number };

/**
 * 빈 매물 목록에서 매물을 등록한다. 주소는 고르지 않고 기본 위치를 쓴다(F02-S01의 정상 등록 경로).
 * 매물 생성 응답을 돌려준다. 등록 성공 여부와 이동한 화면은 호출한 쪽이 판정한다.
 */
export const registerProperty = async (page: Page, input: PropertyInput): Promise<Response> => {
  const form = propertyForm(page);
  // 주소를 고르지 않으면 등록 화면이 기본 위치의 주소를 조회한다. 조회가 끝난 뒤 위치 단계를 넘긴다.
  const defaultLocationLoaded = page
    .waitForResponse(isApiResponse('GET', '/api/maps/reverse-geocode'), { timeout: 15_000 })
    .catch(() => null);

  await test.step('매물 등록 화면으로 이동', () => openCreateFormFromEmptyList(page));

  await test.step('보증금과 월세 입력', async () => {
    await form.deposit.fill(String(input.depositManwon));
    await form.deposit.press('Enter');
    await form.monthlyRent.fill(String(input.monthlyRentManwon));
    await form.monthlyRent.press('Enter');
  });

  await test.step('주소는 고르지 않고 다음으로 진행', async () => {
    await defaultLocationLoaded;
    await form.next.click();
  });

  await test.step('이름 입력란을 선택해 매물 이름 입력', async () => {
    await form.name.click();
    await form.name.fill(input.name);
  });

  return test.step('등록', async () => {
    const responsePromise = page.waitForResponse(isApiResponse('POST', '/api/properties'));
    await form.submit.click();
    return responsePromise;
  });
};

/**
 * 입력란이 오류 상태이면 입력란에 연결된 안내 문구를 돌려준다. 오류 상태가 아니면 null이다.
 * 안내가 화면에 보이는지가 아니라 입력란과 연결되어 있는지를 본다. 화면 읽기 프로그램 사용자도 같은 안내를 받는다.
 */
export const readFieldError = async (field: Locator): Promise<string | null> => {
  if ((await field.getAttribute('aria-invalid')) !== 'true') return null;
  const describedBy = (await field.getAttribute('aria-describedby'))?.split(/\s+/) ?? [];
  const texts = await Promise.all(
    describedBy.map((id) =>
      field
        .page()
        .locator(`[id="${id}"]`)
        .innerText()
        .catch(() => ''),
    ),
  );
  return texts
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .join(' / ');
};
