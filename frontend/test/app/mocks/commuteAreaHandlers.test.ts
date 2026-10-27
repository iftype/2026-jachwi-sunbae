// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';

import { handlers } from '@/app/mocks/handlers';
import { createCommuteAreaHandlers } from '@/app/mocks/handlers/commuteAreaHandlers';

import { server } from '../../server';

const query = '/api/commute-areas/with-rents?latitude=37.5&longitude=127.03&maxMinutes=40';
const read = async (path: string) => {
  const response = await fetch(`http://localhost${path}`);
  return { status: response.status, body: await response.json() };
};
describe('최신 생활권 탐색 MSW', () => {
  beforeEach(() => server.use(...createCommuteAreaHandlers({ delayMs: 0 })));
  it('공용 핸들러에 등록된다', async () => {
    server.resetHandlers();
    server.use(...handlers);
    expect((await read(query)).body.code).toBe('SUCCESS');
  });
  it('한 응답에 동 코드와 시간순 정류장을 포함한다', async () => {
    const { status, body } = await read(query);
    expect(status).toBe(200);
    expect(body.data).toMatchObject({ maxMinutes: 40, areaCount: 3 });
    expect(Object.keys(body.data).sort()).toEqual(['areaCount', 'areas', 'maxMinutes', 'rentEndDate', 'rentStartDate']);
    expect(body.data.areas.map((area: { commuteMinutes: number }) => area.commuteMinutes)).toEqual([3, 27, 38]);
    expect(Object.keys(body.data.areas[0]).sort()).toEqual(
      [
        'adminDongCode',
        'commuteMinutes',
        'depositKrw',
        'legalDongNames',
        'monthlyRentKrw',
        'stations',
        'transactionCount',
      ].sort(),
    );
    expect(body.data.areas[2]).toMatchObject({ monthlyRentKrw: null, transactionCount: null, legalDongNames: [] });
    body.data.areas.forEach((area: { stations: { travelMinutes: number }[] }) => {
      const times = area.stations.map((station) => station.travelMinutes);
      expect(times).toEqual([...times].sort((a, b) => a - b));
    });
    expect(body.data.areas[0].stations[0].direction).toBeNull();
    // 서버는 정류장 방향을 더 쓰지 않아 늘 null로 보낸다(POL-COMMUTE-016).
    expect(body.data.areas[0].stations[1].direction).toBeNull();
  });
  it('선택 파라미터 누락은 60분·2회 기본값을 적용한다', async () => {
    expect((await read('/api/commute-areas/with-rents?latitude=37.5&longitude=127')).body.data).toMatchObject({
      maxMinutes: 60,
      areaCount: 3,
    });
  });
  it.each([
    [1, 0],
    [3, 1],
    [26, 1],
    [27, 2],
    [38, 3],
    [180, 3],
  ])('%i분에서 %i개 동을 반환한다', async (minutes, count) => {
    expect((await read(query.replace('maxMinutes=40', `maxMinutes=${minutes}`))).body.data.areaCount).toBe(count);
  });
  it('최대 환승 0회면 내부 테스트 경로의 환승 후보를 제외한다', async () => {
    const { body } = await read(`${query}&maxTransfers=0`);
    expect(body.data.areaCount).toBe(2);
    expect(body.data.areas[0]).not.toHaveProperty('transferCount');
  });
  it('시간 범위를 넘는 정류장을 제외하고 남은 최소 시간으로 집계한다', async () => {
    const { body } = await read(query.replace('maxMinutes=40', 'maxMinutes=3'));
    expect(body.data.areas[0].stations).toHaveLength(1);
    expect(body.data.areas[0].commuteMinutes).toBe(3);
  });
  it.each([
    ['maxMinutes', ''],
    ['maxMinutes', '0'],
    ['maxMinutes', '181'],
    ['maxMinutes', '1.5'],
    ['maxTransfers', ''],
    ['maxTransfers', '-1'],
    ['maxTransfers', '11'],
    ['maxTransfers', '1.5'],
    ['latitude', ''],
    ['latitude', '91'],
    ['latitude', 'Infinity'],
    ['longitude', '181'],
    ['longitude', 'abc'],
  ])('%s=%s는 400 오류다', async (field, value) => {
    const params = new URLSearchParams('latitude=37.5&longitude=127&maxMinutes=40');
    params.set(field, value);
    expect(await read(`/api/commute-areas/with-rents?${params}`)).toMatchObject({
      status: 400,
      body: { code: 'INVALID_REQUEST', errors: [{ field }] },
    });
  });
  it('필수 누락은 좌표만 오류로 반환한다', async () => {
    expect(
      (await read('/api/commute-areas/with-rents')).body.errors.map((error: { field: string }) => error.field),
    ).toEqual(['latitude', 'longitude']);
  });
  it('빈 결과를 처리한다', async () => {
    server.use(...createCommuteAreaHandlers({ scenario: 'empty', delayMs: 0 }));
    expect((await read(query)).body.data).toMatchObject({ areaCount: 0, areas: [] });
  });
  it.each([
    [
      'unreachable',
      400,
      'COMMUTE_DESTINATION_UNREACHABLE',
      '목적지에서 걸어서 10분 안에 이용할 수 있는 정류장·역이 없습니다.',
    ],
    [
      'network-unavailable',
      503,
      'TRANSIT_NETWORK_UNAVAILABLE',
      '대중교통 정보를 준비하고 있습니다. 잠시 후 다시 시도해 주세요.',
    ],
  ] as const)('%s 오류를 반환한다', async (scenario, status, code, message) => {
    server.use(...createCommuteAreaHandlers({ scenario, delayMs: 0 }));
    expect(await read(query)).toEqual({ status, body: { code, message, errors: [] } });
  });
});
