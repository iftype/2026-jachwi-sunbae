import type { Locator, Page } from '@playwright/test';

import { isApiResponse, readJson, watchRequests } from '../src/api';
import { expect, test } from '../src/fixtures';
import { registerProperty } from '../src/property-form';
import { type ExpectedOutcome, fail, needsReview, pass, ScenarioRun } from '../src/scenario-run';

// qa/docs/scenarios/F06-S01-check-status-progress.md

type Status = 'GOOD' | 'CAUTION' | 'UNCONFIRMED';
const STATUS_LABEL: Record<Status, string> = { GOOD: '괜찮음', CAUTION: '주의', UNCONFIRMED: '미확인' };
const labelOf = (status: string | undefined): string => STATUS_LABEL[status as Status] ?? String(status);

// 테스트 데이터. 항목 순서별로 고르는 상태이고, 마지막 값이 최종 상태다. 나머지 항목은 조작하지 않는다.
const OPERATIONS: Status[][] = [['GOOD'], ['CAUTION'], ['GOOD', 'UNCONFIRMED']];
const MIN_ITEMS = OPERATIONS.length;

type Progress = {
  totalCount: number;
  completedCount: number;
  goodCount: number;
  cautionCount: number;
  unconfirmedCount: number;
  progressRate: number;
};
type ChecklistBody = { data: { id: number; stage: string; items: { displayOrder: number; status: Status }[] } };
type ChecklistStatusBody = { data: { stages: { stage: string; propertyChecklistId: number; progress: Progress }[] } };
type PropertyBody = { data: { id: number } };

const finalStatuses = (total: number): Status[] =>
  Array.from({ length: total }, (_, index) => OPERATIONS[index]?.at(-1) ?? 'UNCONFIRMED');

/** 명세의 집계 규칙으로 기대 집계를 계산한다. `POL-PROGRESS-001`, `POL-PROGRESS-002` */
const expectedProgress = (total: number): Progress => {
  const statuses = finalStatuses(total);
  const goodCount = statuses.filter((status) => status === 'GOOD').length;
  const cautionCount = statuses.filter((status) => status === 'CAUTION').length;
  const completedCount = goodCount + cautionCount;
  return {
    totalCount: total,
    completedCount,
    goodCount,
    cautionCount,
    unconfirmedCount: total - completedCount,
    progressRate: total === 0 ? 0 : Math.floor((completedCount * 100) / total),
  };
};

const describeProgress = (progress: Progress): string =>
  `전체 ${progress.totalCount}, 완료 ${progress.completedCount}, 괜찮음 ${progress.goodCount}, ` +
  `주의 ${progress.cautionCount}, 미확인 ${progress.unconfirmedCount}, 진행률 ${progress.progressRate}`;

/** 화면에서 읽은 집계. 표기를 찾지 못한 값은 null이다. */
type ScreenSummary = {
  where: string;
  counts: { good: number; caution: number; unconfirmed: number } | null;
  ratio: { completed: number; total: number } | null;
  percents: number[];
};

const RATIO = /^\s*(\d+)\s*\/\s*(\d+)\s*$/;

// 집계를 어떤 형식으로 보여줄지는 명세가 정하지 않았다. 상태별 수 목록과 `완료/전체` 표기, `숫자%` 표기만 코드가 읽는다.
const readSummary = async (scope: Locator, where: string): Promise<ScreenSummary> => {
  const legend = scope.getByRole('list', { name: '체크리스트 진행 결과 집계' });
  const ratioText = scope.getByText(RATIO);

  let counts: ScreenSummary['counts'] = null;
  if ((await legend.count()) > 0) {
    const text = (await legend.first().innerText()).replace(/\s+/g, ' ');
    const read = (label: string): number | null => {
      const match = new RegExp(`(?:^|\\s)${label}\\s*(\\d+)`).exec(text);
      return match === null ? null : Number(match[1]);
    };
    const [good, caution, unconfirmed] = ['괜찮음', '주의', '미확인'].map(read);
    if (good !== null && caution !== null && unconfirmed !== null) counts = { good, caution, unconfirmed };
  }

  let ratio: ScreenSummary['ratio'] = null;
  if ((await ratioText.count()) > 0) {
    const match = RATIO.exec(await ratioText.first().innerText());
    if (match !== null) ratio = { completed: Number(match[1]), total: Number(match[2]) };
  }

  const percents = [...(await scope.innerText()).matchAll(/(\d+)\s*%/g)].map((match) => Number(match[1]));
  return { where, counts, ratio, percents };
};

type Comparison = { matches: boolean | null; description: string };

/** 화면 집계를 기대 집계와 비교한다. 읽을 수 있는 표기가 하나도 없으면 matches가 null이다. */
const compareSummary = (summary: ScreenSummary, expected: Progress): Comparison => {
  const parts: string[] = [];
  let matches: boolean | null = null;
  if (summary.counts !== null) {
    const { good, caution, unconfirmed } = summary.counts;
    parts.push(`괜찮음 ${good}, 주의 ${caution}, 미확인 ${unconfirmed}`);
    matches =
      good === expected.goodCount && caution === expected.cautionCount && unconfirmed === expected.unconfirmedCount;
  }
  if (summary.ratio !== null) {
    parts.push(`완료/전체 ${summary.ratio.completed}/${summary.ratio.total}`);
    const ratioMatches =
      summary.ratio.completed === expected.completedCount && summary.ratio.total === expected.totalCount;
    matches = (matches ?? true) && ratioMatches;
  }
  return {
    matches,
    description: `${summary.where} ${parts.length > 0 ? parts.join(', ') : '집계 표기를 찾지 못함'}`,
  };
};

/** 하나라도 다르면 FAIL, 다르지 않지만 읽지 못한 화면이 있으면 NEEDS_REVIEW다. */
const judgeComparisons = (comparisons: Comparison[], expected: Progress): ExpectedOutcome => {
  const actual = `기대 ${describeProgress(expected)}. 화면: ${comparisons.map((item) => item.description).join('; ')}`;
  if (comparisons.some((item) => item.matches === false)) return fail(actual);
  if (comparisons.some((item) => item.matches === null)) return needsReview(actual);
  return pass(actual);
};

/** 화면 갱신을 기다린다. 기대 값이 나타나지 않아도 실패시키지 않고, 판정은 그 뒤에 읽은 값으로 한다. */
const settle = (scope: Locator, expected: Progress): Promise<void> =>
  scope
    .getByText(`${expected.completedCount}/${expected.totalCount}`)
    .first()
    .waitFor({ timeout: 5_000 })
    .catch(() => undefined);

const checkedStatuses = (page: Page): Promise<string[]> =>
  page
    .getByRole('main')
    .getByRole('group')
    .evaluateAll((groups) =>
      groups.map((group) => group.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.value ?? '선택 없음'),
    );

test('F06-S01 체크 상태 저장과 진행 현황 집계', async ({ page, member }, testInfo) => {
  const run = ScenarioRun.start('F06-S01', member, page, testInfo);
  const propertyName = `F06-S01 ${member.runId}`;
  const checklistItems = page.getByRole('main').getByRole('group');

  await run.execute(async () => {
    const createResponse = await registerProperty(page, { name: propertyName, depositManwon: 500, monthlyRentManwon: 50 });
    const propertyId = (await readJson<PropertyBody>(createResponse))?.data?.id;
    if (!createResponse.ok() || propertyId === undefined) {
      throw new Error(`사전 조건 실패: 매물을 등록하지 못했다(생성 응답 ${createResponse.status()}).`);
    }
    await page.waitForURL(new RegExp(`/properties/${propertyId}$`));

    const { checklistId, total } = await test.step('현장 체크리스트를 열고 항목 수 확인', async () => {
      const checklistResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === 'GET' &&
          new RegExp(`^/api/properties/${propertyId}/checklists/\\d+$`).test(new URL(response.url()).pathname),
      );
      await page.getByRole('region', { name: '체크리스트' }).getByRole('link', { name: '체크리스트' }).click();
      const checklist = (await readJson<ChecklistBody>(await checklistResponsePromise))?.data;
      if (checklist?.stage !== 'ON_SITE') {
        throw new Error(`사전 조건 실패: 연 체크리스트가 현장 단계가 아니다(${checklist?.stage}).`);
      }
      await checklistItems.first().waitFor();
      const count = await checklistItems.count();
      if (count < MIN_ITEMS) {
        throw new Error(`사전 조건 실패: 현장 체크리스트 항목이 ${count}개라 ${MIN_ITEMS}개 미만이다.`);
      }
      return { checklistId: checklist.id, total: count };
    });
    const expected = expectedProgress(total);
    const statusPath = new RegExp(`^/api/properties/${propertyId}/checklists/${checklistId}/items/\\d+/status$`);
    const checklistComparisons: Comparison[] = [];
    const summaries: ScreenSummary[] = [];

    const statusRequests = watchRequests(
      page,
      'PATCH',
      statusPath,
      `/api/properties/${propertyId}/checklists/${checklistId}/items/{itemId}/status`,
    );
    await test.step('항목 상태 고르기', async () => {
      for (const [index, statuses] of OPERATIONS.entries()) {
        for (const status of statuses) {
          const radio = checklistItems.nth(index).getByRole('radio', { name: STATUS_LABEL[status] });
          const saved = page.waitForResponse(
            (response) => response.request().method() === 'PATCH' && statusPath.test(new URL(response.url()).pathname),
          );
          await radio.click();
          await saved;
          await expect(radio).toBeChecked();
        }
      }
    });
    const requests = await run.captureRequests('EV1', statusRequests);

    await test.step('체크리스트 진행 현황 확인', async () => {
      const main = page.getByRole('main');
      await settle(main, expected);
      const summary = await readSummary(main, '체크리스트(고른 직후)');
      summaries.push(summary);
      checklistComparisons.push(compareSummary(summary, expected));
      await run.captureScreen('EV2');
    });

    const reloadedChecklist = await test.step('새로고침 후 다시 확인', async () => {
      const responsePromise = page.waitForResponse(
        isApiResponse('GET', `/api/properties/${propertyId}/checklists/${checklistId}`),
      );
      await page.reload();
      const response = await responsePromise;
      await run.captureApi('EV3', response);
      await checklistItems.first().waitFor();
      const main = page.getByRole('main');
      await settle(main, expected);
      const summary = await readSummary(main, '체크리스트(새로고침 후)');
      summaries.push(summary);
      checklistComparisons.push(compareSummary(summary, expected));
      await run.captureScreen('EV3');
      return { response, screenStatuses: await checkedStatuses(page) };
    });

    await run.check('E1', async () => {
      const expectedStatuses = finalStatuses(total);
      const expectedRequests = OPERATIONS.flat();
      const items = (await readJson<ChecklistBody>(reloadedChecklist.response))?.data?.items ?? [];
      const apiStatuses = [...items].sort((a, b) => a.displayOrder - b.displayOrder).map((item) => item.status);
      const sent = requests.map((request) => {
        const status = request.body === null ? '본문 없음' : labelOf((JSON.parse(request.body) as { status?: string }).status);
        return `${status} ${request.status ?? '응답 없음'}`;
      });
      const allSaved =
        requests.length === expectedRequests.length &&
        requests.every((request) => request.status !== null && request.status < 300);
      const same = (statuses: string[]): boolean => statuses.join() === expectedStatuses.join();
      const actual =
        `상태 변경 요청 ${requests.length}건(${sent.join(', ')}), ` +
        `새로고침 후 화면 ${reloadedChecklist.screenStatuses.map(labelOf).join(', ')}, ` +
        `조회 응답 ${apiStatuses.map(labelOf).join(', ')}. 기대 ${expectedStatuses.map(labelOf).join(', ')}`;
      return allSaved && same(reloadedChecklist.screenStatuses) && same(apiStatuses) ? pass(actual) : fail(actual);
    });

    await run.check('E3', async () => judgeComparisons(checklistComparisons, expected));

    await test.step('매물 상세로 돌아가 집계 확인', async () => {
      const responsePromise = page.waitForResponse(isApiResponse('GET', `/api/properties/${propertyId}/checklists`));
      await page.getByRole('link', { name: '매물 상세로 돌아가기' }).click();
      await page.waitForURL(new RegExp(`/properties/${propertyId}$`));
      const response = await responsePromise;
      await run.captureApi('EV4', response);

      await run.check('E2', async () => {
        const stage = (await readJson<ChecklistStatusBody>(response))?.data?.stages?.find(
          (item) => item.stage === 'ON_SITE',
        );
        if (stage === undefined) return fail(`체크 현황 조회 응답 ${response.status()}, 현장 단계 집계가 없다.`);
        const actual = `현장 단계 ${describeProgress(stage.progress)}. 기대 ${describeProgress(expected)}`;
        const matches = (Object.keys(expected) as (keyof Progress)[]).every(
          (key) => stage.progress[key] === expected[key],
        );
        return matches ? pass(actual) : fail(actual);
      });

      const region = page.getByRole('region', { name: '체크리스트' });
      await settle(region, expected);
      const summary = await readSummary(region, '매물 상세');
      summaries.push(summary);
      await run.check('E4', async () => judgeComparisons([compareSummary(summary, expected)], expected));
      await run.captureScreen('EV4', region);
    });

    await test.step('매물 목록으로 이동해 집계 확인', async () => {
      const responsePromise = page
        .waitForResponse(isApiResponse('GET', '/api/properties'), { timeout: 10_000 })
        .catch(() => null);
      await page.getByRole('navigation', { name: '주요 메뉴' }).getByRole('link', { name: '홈' }).click();
      await expect(page).toHaveURL(/\/properties$/);
      const response = await responsePromise;
      if (response !== null) await run.captureApi('EV5', response);

      const card = page.getByRole('region', { name: '매물 목록' }).getByRole('article').filter({ hasText: propertyName });
      await card.first().waitFor({ timeout: 10_000 });
      await settle(card.first(), expected);
      const summary = await readSummary(card.first(), '매물 목록 카드');
      summaries.push(summary);
      await run.check('E5', async () => judgeComparisons([compareSummary(summary, expected)], expected));
      await run.captureScreen('EV5', card.first());
    });

    await run.check('E6', async () => {
      const found = summaries.flatMap((summary) => summary.percents.map((percent) => `${summary.where} ${percent}%`));
      const shown = summaries.map((summary) => compareSummary(summary, expected).description).join('; ');
      if (found.length === 0) {
        // 막대 등 다른 방식으로 진행률을 표시했을 수 있으므로 AI가 화면을 해석한다.
        return needsReview(
          `세 화면에서 \`숫자%\` 형식의 진행률 표기를 찾지 못했다. 기대 진행률 ${expected.progressRate}%. 보인 집계: ${shown}`,
        );
      }
      const actual = `진행률 표기 ${found.join(', ')}. 기대 ${expected.progressRate}%`;
      return summaries.every((summary) => summary.percents.every((percent) => percent === expected.progressRate))
        ? pass(actual)
        : fail(actual);
    });
  });
});
