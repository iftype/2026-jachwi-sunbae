import { type ApiCall, callApi, parseApiCall, readJson } from '../src/api';
import { test } from '../src/fixtures';
import { registerProperty } from '../src/property-form';
import { fail, needsReview, pass, ScenarioRun } from '../src/scenario-run';

// qa/docs/scenarios/F03-S01-property-access-other-member.md

type PropertyData = {
  id: number;
  name: string;
  depositAmount: number;
  monthlyRentAmount: number;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  updatedAt: string;
};
type PropertyBody = { data: PropertyData };
type PropertyListBody = { data: { totalCount: number; items: { id: number }[] } };

// 매물 정보가 같은지 비교하는 항목. 판정 메모 참고
const COMPARED_FIELDS = ['name', 'depositAmount', 'monthlyRentAmount', 'address', 'latitude', 'longitude', 'updatedAt'] as const;

const changedFields = (before: PropertyData, after: PropertyData): string[] =>
  COMPARED_FIELDS.filter((field) => before[field] !== after[field]).map(
    (field) => `${field} ${String(before[field])} → ${String(after[field])}`,
  );

test('F03-S01 다른 회원의 매물 접근', async ({ page, member, otherMember, request }, testInfo) => {
  const run = ScenarioRun.start('F03-S01', member, page, testInfo);
  const propertyName = `F03-S01 ${member.runId}`;
  // 응답 본문에 대상 매물의 이름이 있으면 내용이 노출된 것으로 본다.
  const exposure = (call: ApiCall): string =>
    call.responseText.includes(propertyName) ? ', 응답 본문에 매물 이름 있음' : ', 응답 본문에 매물 이름 없음';
  const exposes = (call: ApiCall): boolean => call.responseText.includes(propertyName);

  await run.execute(async () => {
    const createResponse = await registerProperty(page, { name: propertyName, depositManwon: 500, monthlyRentManwon: 50 });
    const propertyId = (await readJson<PropertyBody>(createResponse))?.data?.id;
    if (!createResponse.ok() || propertyId === undefined) {
      throw new Error(`사전 조건 실패: 주인 회원이 매물을 등록하지 못했다(생성 응답 ${createResponse.status()}).`);
    }
    await page.waitForURL(new RegExp(`/properties/${propertyId}$`));
    const propertyUrl = `${member.apiOrigin}/api/properties/${propertyId}`;

    const before = await test.step('주인 회원의 상세 정보 기록', async () => {
      const call = await callApi(request, 'GET', propertyUrl, { token: member.accessToken });
      run.captureApiCall('EV1', call);
      const data = parseApiCall<PropertyBody>(call)?.data;
      if (call.status !== 200 || data === undefined) {
        throw new Error(`사전 조건 실패: 주인 회원이 등록한 매물을 조회하지 못했다(${call.status}).`);
      }
      return data;
    });

    await test.step('다른 회원으로 상세 조회', async () => {
      const call = await callApi(request, 'GET', propertyUrl, { token: otherMember.accessToken });
      run.captureApiCall('EV2', call);
      await run.check('E1', async () => {
        const actual = `다른 회원(${otherMember.nickname})의 상세 조회 응답 ${call.status}${exposure(call)}`;
        return call.status === 404 && !exposes(call) ? pass(actual) : fail(actual);
      });
    });

    const updateCall = await test.step('다른 회원으로 수정 요청', async () => {
      const call = await callApi(request, 'PUT', propertyUrl, {
        token: otherMember.accessToken,
        // 입력 형식 오류로 거부되지 않도록 올바른 값을 보낸다. API 금액 단위는 원이다.
        body: {
          name: `${propertyName} 변경 시도`,
          depositAmount: 1_230_000,
          monthlyRentAmount: 120_000,
          address: before.address,
          latitude: before.latitude,
          longitude: before.longitude,
          discoverySource: '',
          roomOptions: [],
          utilityOptions: [],
        },
      });
      run.captureApiCall('EV3', call);
      return call;
    });

    const deleteCall = await test.step('다른 회원으로 삭제 요청', async () => {
      const call = await callApi(request, 'DELETE', propertyUrl, { token: otherMember.accessToken });
      run.captureApiCall('EV4', call);
      return call;
    });

    await test.step('인증 없이 상세 조회', async () => {
      const call = await callApi(request, 'GET', propertyUrl);
      run.captureApiCall('EV5', call);
      await run.check('E4', async () => {
        const actual = `인증 없는 상세 조회 응답 ${call.status}${exposure(call)}`;
        return call.status === 401 && !exposes(call) ? pass(actual) : fail(actual);
      });
    });

    await test.step('주인 회원으로 다시 조회해 비교', async () => {
      const detailCall = await callApi(request, 'GET', propertyUrl, { token: member.accessToken });
      run.captureApiCall('EV6', detailCall);
      const listCall = await callApi(request, 'GET', `${member.apiOrigin}/api/properties`, { token: member.accessToken });
      run.captureApiCall('EV6', listCall);
      const after = parseApiCall<PropertyBody>(detailCall)?.data;
      const listedIds = parseApiCall<PropertyListBody>(listCall)?.data?.items?.map((item) => item.id) ?? [];

      await run.check('E2', async () => {
        const changes = after === undefined ? null : changedFields(before, after);
        const comparison =
          changes === null
            ? `주인 회원의 재조회 응답 ${detailCall.status}, 매물 정보를 읽지 못함`
            : changes.length === 0
              ? `주인 회원의 재조회 결과 시도 전과 같음(이름 "${after!.name}", 수정 시각 ${after!.updatedAt})`
              : `주인 회원의 재조회 결과 바뀐 항목: ${changes.join(', ')}`;
        const actual = `다른 회원의 수정 응답 ${updateCall.status}${exposure(updateCall)}. ${comparison}`;
        if (updateCall.status !== 404 || exposes(updateCall)) return fail(actual);
        // 재조회로 매물 정보를 읽지 못하면 바뀌었는지 알 수 없다. 삭제되었다면 E3이 판정한다.
        if (changes === null) return needsReview(actual);
        return updateCall.status === 404 && !exposes(updateCall) && changes !== null && changes.length === 0
          ? pass(actual)
          : fail(actual);
      });

      await run.check('E3', async () => {
        const remains = detailCall.status === 200 && listedIds.includes(propertyId);
        const actual =
          `다른 회원의 삭제 응답 ${deleteCall.status}. 주인 회원의 상세 조회 응답 ${detailCall.status}, ` +
          `목록 조회 응답 ${listCall.status}(대상 매물 ${listedIds.includes(propertyId) ? '있음' : '없음'})`;
        return deleteCall.status === 404 && remains ? pass(actual) : fail(actual);
      });

      await page.reload();
      const basicInfo = page.getByRole('region', { name: '매물 기본 정보' });
      await basicInfo.waitFor({ timeout: 10_000 }).catch(() => undefined);
      await run.captureScreen('EV7', basicInfo);
    });
  });
});
