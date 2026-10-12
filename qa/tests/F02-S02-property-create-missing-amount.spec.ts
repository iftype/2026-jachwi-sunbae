import type { Locator } from '@playwright/test';

import { isApiResponse, readJson, watchRequests } from '../src/api';
import { expect, test } from '../src/fixtures';
import { openCreateFormFromEmptyList, propertyForm, readFieldError } from '../src/property-form';
import { fail, needsReview, pass, ScenarioRun } from '../src/scenario-run';

// qa/docs/scenarios/F02-S02-property-create-missing-amount.md

type CaseResult = {
  label: string;
  /** 막혀야 할 다음 단계나 상세 화면으로 넘어갔는지 */
  progressed: boolean;
  progress: string;
  field: string;
  /** 빠진 값의 입력란에 연결된 안내. 오류 상태가 아니면 null */
  fieldError: string | null;
};

type PropertyListBody = { data: { totalCount: number } };

const isShown = (locator: Locator, timeout: number): Promise<boolean> =>
  locator
    .waitFor({ state: 'visible', timeout })
    .then(() => true)
    .catch(() => false);

/** 입력란이 오류 상태가 될 때까지 기다린다. 끝내 오류 상태가 되지 않으면 false다. */
const becomesInvalid = (field: Locator): Promise<boolean> =>
  expect(field)
    .toHaveAttribute('aria-invalid', 'true', { timeout: 5_000 })
    .then(() => true)
    .catch(() => false);

const describeError = (fieldError: string | null): string =>
  fieldError === null ? '오류 표시 없음' : fieldError.length === 0 ? '오류 상태지만 안내 문구 없음' : `안내 "${fieldError}"`;

test('F02-S02 보증금·월세 누락 등록', async ({ page, member }, testInfo) => {
  const run = ScenarioRun.start('F02-S02', member, page, testInfo);
  const form = propertyForm(page);
  const cases: CaseResult[] = [];

  await run.execute(async () => {
    // 주소를 고르지 않으면 등록 화면이 기본 위치의 주소를 조회한다. 조회가 끝난 뒤 위치 단계를 넘긴다.
    const defaultLocationLoaded = page
      .waitForResponse(isApiResponse('GET', '/api/maps/reverse-geocode'), { timeout: 15_000 })
      .catch(() => null);
    const createRequests = watchRequests(page, 'POST', '/api/properties');

    await test.step('매물 등록 화면으로 이동', async () => {
      await openCreateFormFromEmptyList(page);
    });

    await test.step('경우 A: 보증금을 비운 채 다음 단계로 진행 시도', async () => {
      await form.deposit.press('Enter');
      await becomesInvalid(form.deposit);
      const progressed = await form.monthlyRent.isVisible();
      cases.push({
        label: 'A',
        progressed,
        progress: progressed ? '월세 입력란이 나타남' : '다음 단계로 넘어가지 않음',
        field: '보증금',
        fieldError: await readFieldError(form.deposit),
      });
      await run.captureScreen('EV1');
    });

    await test.step('보증금에 0을 입력하고 다음 단계로 진행', async () => {
      await form.deposit.fill('0');
      await form.deposit.press('Enter');
      const progressed = await isShown(form.monthlyRent, 5_000);
      const depositError = await readFieldError(form.deposit);
      await run.captureScreen('EV2');
      await run.check('E3', async () => {
        const actual = `보증금 0 입력 후 ${progressed ? '월세 입력란이 나타남' : '다음 단계로 넘어가지 않음'}, 보증금 입력란 ${describeError(depositError)}`;
        return progressed && depositError === null ? pass(actual) : fail(actual);
      });
    });

    await test.step('경우 B: 월세를 비운 채 다음 단계로 진행 시도', async () => {
      await form.monthlyRent.press('Enter');
      await becomesInvalid(form.monthlyRent);
      const progressed = await page.getByText('위치를 선택해 주세요').isVisible();
      cases.push({
        label: 'B',
        progressed,
        progress: progressed ? '위치 선택 단계가 나타남' : '다음 단계로 넘어가지 않음',
        field: '월세',
        fieldError: await readFieldError(form.monthlyRent),
      });
      await run.captureScreen('EV3');
    });

    await test.step('월세를 입력하고 이름 단계까지 진행해 매물 이름 입력', async () => {
      await form.monthlyRent.fill('50');
      await form.monthlyRent.press('Enter');
      await defaultLocationLoaded;
      await form.next.click();
      await form.name.click();
      await form.name.fill(`F02-S02 ${member.runId}`);
    });

    await test.step('경우 C: 보증금 입력란을 지우고 등록 시도', async () => {
      await form.deposit.fill('');
      await form.submit.click();
      await becomesInvalid(form.deposit);
      const progressed = await page
        .waitForURL(/\/properties\/\d+$/, { timeout: 3_000 })
        .then(() => true)
        .catch(() => false);
      cases.push({
        label: 'C',
        progressed,
        progress: progressed ? `상세 화면으로 이동함(${new URL(page.url()).pathname})` : '등록되지 않고 등록 화면에 남음',
        field: '보증금',
        fieldError: await readFieldError(form.deposit),
      });
      await run.captureScreen('EV4');
    });

    const requests = await run.captureRequests('EV5', createRequests);

    await run.check('E1', async () => {
      const created = requests.filter((request) => request.status !== null && request.status < 300);
      const statuses = requests.map((request) => request.status ?? '응답 없음').join(', ');
      const actual =
        `${cases.map((item) => `${item.label}: ${item.progress}`).join(', ')}. ` +
        `매물 생성 요청 ${requests.length}건${requests.length > 0 ? `(${statuses})` : ''}`;
      return cases.every((item) => !item.progressed) && created.length === 0 ? pass(actual) : fail(actual);
    });

    await run.check('E2', async () => {
      const actual = cases.map((item) => `${item.label}: ${item.field} 입력란 ${describeError(item.fieldError)}`).join(', ');
      // 입력란에 연결된 안내를 찾지 못하면 다른 방식으로 안내했을 수 있으므로 AI가 화면을 해석한다.
      return cases.every((item) => item.fieldError !== null && item.fieldError.length > 0) ? pass(actual) : needsReview(actual);
    });

    await test.step('매물 목록으로 이동', async () => {
      const listResponsePromise = page
        .waitForResponse(isApiResponse('GET', '/api/properties'), { timeout: 10_000 })
        .catch(() => null);
      await form.close.click();
      await expect(page).toHaveURL(/\/properties$/);
      const listResponse = await listResponsePromise;
      if (listResponse !== null) await run.captureApi('EV6', listResponse);

      await run.check('E4', async () => {
        const cards = page.getByRole('region', { name: '매물 목록' }).getByRole('article');
        const emptyNotice = page.getByText('아직 등록한 매물이 없어요.');
        await isShown(emptyNotice.or(cards.first()), 10_000);
        const cardCount = await cards.count();
        const totalCount =
          listResponse === null ? undefined : (await readJson<PropertyListBody>(listResponse))?.data?.totalCount;
        const actual =
          `목록 카드 ${cardCount}건, 빈 목록 안내 ${(await emptyNotice.isVisible()) ? '표시' : '없음'}, ` +
          `목록 조회 응답 ${totalCount === undefined ? '없음(캐시 사용)' : `${totalCount}건`}`;
        return cardCount === 0 && (totalCount === undefined || totalCount === 0) ? pass(actual) : fail(actual);
      });
      await run.captureScreen('EV6');
    });
  });
});
