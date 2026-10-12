import type { Locator, Page } from '@playwright/test';

import { isApiResponse, readJson } from '../src/api';
import { expect, test } from '../src/fixtures';
import { openCreateFormFromEmptyList, propertyForm } from '../src/property-form';
import { fail, needsReview, pass, ScenarioRun } from '../src/scenario-run';

// qa/docs/scenarios/F02-S03-property-create-default-location.md

// 판교 사옥 주소(POL-MAP-002). 시, 구 표기와 띄어쓰기 차이는 판정하지 않는다.
const PANGYO_ADDRESS = /금토로\s*80번길\s*40(?!\d)/;
// 위 주소의 좌표로 사람이 확인한 값이다. 명세에는 주소만 있다.
const PANGYO_POSITION = { latitude: 37.406401604461735, longitude: 127.08884281061177 };
const TOLERANCE_METERS = 100;

type Position = { latitude: number; longitude: number };
type PropertyBody = { data: { id: number; address: string; latitude: number | null; longitude: number | null } };

/** 두 좌표 사이의 거리(m). 하버사인 공식 */
const distanceMeters = (a: Position, b: Position): number => {
  const toRadians = (degree: number) => (degree * Math.PI) / 180;
  const dLatitude = toRadians(b.latitude - a.latitude);
  const dLongitude = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLatitude / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLongitude / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
};

// 위치 권한은 브라우저의 위치 조회 호출로 요청된다. 호출을 sessionStorage에 남겨 화면을 다시 불러와도 기록이 유지되게 한다.
const GEOLOCATION_LOG = 'qa.geolocation-calls';
const recordGeolocationCalls = (key: string): void => {
  const geolocation = navigator.geolocation as Geolocation & { __qaRecorded?: boolean };
  if (geolocation === undefined || geolocation.__qaRecorded) return;
  geolocation.__qaRecorded = true;
  for (const method of ['getCurrentPosition', 'watchPosition'] as const) {
    const original = geolocation[method].bind(geolocation) as (...args: unknown[]) => number | void;
    Object.defineProperty(geolocation, method, {
      value: (...args: unknown[]) => {
        const calls = JSON.parse(sessionStorage.getItem(key) ?? '[]') as unknown[];
        calls.push({ method, at: new Date().toISOString(), path: location.pathname });
        sessionStorage.setItem(key, JSON.stringify(calls));
        return original(...args);
      },
    });
  }
};
const readGeolocationCalls = (page: Page): Promise<unknown[]> =>
  page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? '[]') as unknown[], GEOLOCATION_LOG);

/** 매물 상세의 기본 정보에서 주소 값을 읽는다. 찾지 못하면 null이다. */
const readDetailAddress = async (basicInfo: Locator): Promise<string | null> => {
  const value = basicInfo.getByRole('term').filter({ hasText: /^\s*주소\s*$/ }).locator('xpath=following-sibling::dd[1]');
  return (await value.count()) === 0 ? null : (await value.first().innerText()).trim();
};

test('F02-S03 주소를 고르지 않은 등록의 기본 위치', async ({ page, member }, testInfo) => {
  const run = ScenarioRun.start('F02-S03', member, page, testInfo);
  const form = propertyForm(page);

  await run.execute(async () => {
    await page.addInitScript(recordGeolocationCalls, GEOLOCATION_LOG);
    await page.evaluate(recordGeolocationCalls, GEOLOCATION_LOG);

    // 기본 위치의 주소 변환 요청. 프론트엔드가 이 요청 없이 기본 주소를 정할 수도 있으므로 없으면 null이다.
    const reverseGeocode = page
      .waitForResponse(isApiResponse('GET', '/api/maps/reverse-geocode'), { timeout: 15_000 })
      .catch(() => null);

    await test.step('매물 등록 화면으로 이동', () => openCreateFormFromEmptyList(page));

    await test.step('보증금과 월세를 입력하고 위치 단계로 진행', async () => {
      await form.deposit.fill('500');
      await form.deposit.press('Enter');
      await form.monthlyRent.fill('50');
      await form.monthlyRent.press('Enter');
    });

    await test.step('위치 단계의 기본 주소 확인', async () => {
      const response = await reverseGeocode;
      if (response !== null) await run.captureApi('EV1', response);
      if (response !== null && !response.ok()) {
        throw new Error(
          `사전 조건 실패: 기본 위치의 주소 변환 요청이 ${response.status()}로 실패했다. 외부 주소 API 장애일 수 있다.`,
        );
      }

      const locationStep = page.getByRole('region', { name: '매물 위치 선택' });
      await locationStep.waitFor();
      const searchBox = locationStep.getByRole('textbox', { name: '주소 검색' });
      // 주소 변환 결과가 화면에 반영될 때까지 기다린다. 끝내 비어 있으면 빈 값으로 판정한다.
      await expect
        .poll(() => searchBox.inputValue().catch(() => ''), { timeout: 5_000 })
        .not.toBe('')
        .catch(() => undefined);
      const shownAddress = (await searchBox.inputValue().catch(() => '')).trim();
      await run.check('E1', async () => {
        if (shownAddress.length === 0) {
          return needsReview('위치 단계의 주소 검색란이 비어 있어 표시된 기본 주소를 찾지 못했다.');
        }
        const actual = `위치 단계에 표시된 기본 주소 "${shownAddress}"`;
        return PANGYO_ADDRESS.test(shownAddress) ? pass(actual) : fail(actual);
      });
      await run.captureScreen('EV1', locationStep);
    });

    const propertyId = await test.step('주소는 고르지 않고 이름을 입력해 등록', async () => {
      await form.next.click();
      await form.name.click();
      await form.name.fill(`F02-S03 ${member.runId}`);
      const responsePromise = page.waitForResponse(isApiResponse('POST', '/api/properties'));
      await form.submit.click();
      const response = await responsePromise;
      const id = (await readJson<PropertyBody>(response))?.data?.id;
      if (!response.ok() || id === undefined) {
        throw new Error(`매물을 등록하지 못했다(생성 응답 ${response.status()}).`);
      }
      await page.waitForURL(new RegExp(`/properties/${id}$`));
      // 첫 상세 조회가 끝나기 전에 새로고침하면 새로고침 후의 조회 대신 그 응답을 기다리게 된다.
      await page.getByRole('region', { name: '매물 기본 정보' }).getByText(`F02-S03 ${member.runId}`).first().waitFor();
      return id;
    });

    const geolocationCalls = await readGeolocationCalls(page);
    run.captureLog('EV4', 'geolocation-calls', geolocationCalls);
    await run.check('E4', async () => {
      const actual = `등록하는 동안 위치 조회 호출(getCurrentPosition, watchPosition) ${geolocationCalls.length}건`;
      return geolocationCalls.length === 0 ? pass(actual) : fail(actual);
    });

    await test.step('새로고침 후 상세 화면의 주소 확인', async () => {
      const responsePromise = page.waitForResponse(isApiResponse('GET', `/api/properties/${propertyId}`));
      await page.reload();
      const response = await responsePromise;
      await run.captureApi('EV2', response);
      const data = (await readJson<PropertyBody>(response))?.data;
      const position =
        typeof data?.latitude === 'number' && typeof data?.longitude === 'number'
          ? { latitude: data.latitude, longitude: data.longitude }
          : null;
      const distance = position === null ? null : distanceMeters(position, PANGYO_POSITION);
      const positionText =
        position === null
          ? '좌표 없음'
          : `좌표 ${position.latitude}, ${position.longitude}(판교 사옥 기준 좌표에서 약 ${Math.round(distance!)}m)`;

      const basicInfo = page.getByRole('region', { name: '매물 기본 정보' });
      await basicInfo.waitFor();
      const detailAddress = await readDetailAddress(basicInfo);

      await run.check('E2', async () => {
        if (data === undefined) return needsReview(`상세 조회 응답 ${response.status()}의 본문을 읽지 못했다.`);
        const apiAddress = data.address ?? '';
        const actual = `상세 조회 응답 ${response.status()}, 주소 "${apiAddress}", ${positionText}. 상세 화면 주소 ${detailAddress === null ? '찾지 못함' : `"${detailAddress}"`}`;
        if (!PANGYO_ADDRESS.test(apiAddress)) {
          // 주소 문자열이 달라도 좌표가 가까우면 같은 곳을 다르게 표기했을 수 있다.
          return distance !== null && distance <= TOLERANCE_METERS ? needsReview(actual) : fail(actual);
        }
        if (detailAddress === null) return needsReview(actual);
        return detailAddress === apiAddress || PANGYO_ADDRESS.test(detailAddress) ? pass(actual) : fail(actual);
      });

      await run.check('E3', async () => {
        if (data === undefined) return needsReview(`상세 조회 응답 ${response.status()}의 본문을 읽지 못했다.`);
        const actual = `상세 조회 응답의 ${positionText}. 허용 오차 ${TOLERANCE_METERS}m`;
        return distance !== null && distance <= TOLERANCE_METERS ? pass(actual) : fail(actual);
      });
      await run.captureScreen('EV3', basicInfo);
    });
  });
});
