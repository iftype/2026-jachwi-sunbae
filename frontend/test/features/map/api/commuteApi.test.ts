// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, it } from 'vitest';

import { commuteAreaFixtures } from '@/app/mocks/fixtures/commuteAreaFixtures';
import { createCommuteAreaHandlers } from '@/app/mocks/handlers/commuteAreaHandlers';
import { setAuthentication } from '@/features/auth/model/authStore';
import { commuteAreaToRegion, fetchCommuteAreas, parseAdminBoundary } from '@/features/map/api/commuteApi';

import { server } from '../../../server';
const config = { apiBaseUrl: 'http://localhost:8080' };
const load = () => fetchCommuteAreas(config, { latitude: 37.5, longitude: 127.03 }, 40);
beforeEach(() => {
  server.use(...createCommuteAreaHandlers({ delayMs: 0 }));
});
const noRent = { monthlyRentKrw: null, depositKrw: null, transactionCount: null, legalDongNames: [] };
const respond = (area: object, period = { rentStartDate: null, rentEndDate: null }) =>
  server.use(
    http.get('*/api/commute-areas/with-rents', () =>
      HttpResponse.json({
        code: 'SUCCESS',
        message: '성공',
        data: { maxMinutes: 40, areaCount: 1, ...period, areas: [{ ...noRent, ...area }] },
      }),
    ),
  );
it('서버의 행정동 코드·정류장·시세를 파싱하고 환승·경계를 가정하지 않는다', async () => {
  const result = await load();
  const region = commuteAreaToRegion(result.areas[0]);
  expect(region.polygons).toEqual([]);
  expect(region.summary).toEqual({ travel: '3분', price: '68만원' });
  expect(result.rentPeriod).toEqual({ startDate: '2026-03-31', endDate: '2026-09-30' });
  expect(result.areas.at(-1)?.rent).toBeNull();
  expect(result.areas[0].stations[1].direction).toBeNull();
  expect(result.areas.every((area) => /^\d{8}$/.test(area.adminDongCode))).toBe(true);
});
it('통근 조회도 회원 인증 헤더와 요청 조건을 함께 보낸다', async () => {
  setAuthentication({ accessToken: 'mock', tokenType: 'Bearer', expiresIn: 3600 });
  let authorization: string | null = 'unobserved';
  let transfers: string | null = null;
  server.use(
    http.get('*/api/commute-areas/with-rents', ({ request }) => {
      authorization = request.headers.get('Authorization');
      transfers = new URL(request.url).searchParams.get('maxTransfers');
      return HttpResponse.json({
        code: 'SUCCESS',
        message: '성공',
        data: {
          maxMinutes: 40,
          areaCount: 1,
          rentStartDate: null,
          rentEndDate: null,
          areas: [{ ...commuteAreaFixtures[0], ...noRent }],
        },
      });
    }),
  );
  await fetchCommuteAreas(config, { latitude: 37.5, longitude: 127.03 }, 40, 1);
  expect(authorization).toBe('Bearer mock');
  expect(transfers).toBe('1');
});
it('거래가 적어 금액이 빈 동네는 시세 없음으로, 기간이 비면 기간 없음으로 읽는다', async () => {
  respond(commuteAreaFixtures[0]);
  const result = await load();
  expect(result.areas[0].rent).toBeNull();
  expect(result.rentPeriod).toBeNull();
  expect(commuteAreaToRegion(result.areas[0]).summary).toEqual({ travel: '3분', price: undefined });
});
it('시세 필드가 빠지거나 거래 수가 0인 응답은 거절한다', async () => {
  respond({ ...commuteAreaFixtures[0], legalDongNames: undefined });
  await expect(load()).rejects.toThrow();
  respond({ ...commuteAreaFixtures[0], monthlyRentKrw: 500000, depositKrw: 0, transactionCount: 0 });
  await expect(load()).rejects.toThrow();
});
it('이전 초안의 10자리 행정동 코드는 거절한다', async () => {
  respond({ ...commuteAreaFixtures[0], adminDongCode: '1168064000' });
  await expect(load()).rejects.toThrow();
});
it('동네 코드만 내려오는 응답을 허용한다', async () => {
  respond(commuteAreaFixtures[0]);
  const result = await load();
  expect(result.areas[0].adminDongCode).toBe('11230640');
  expect(result.areas[0].polygons).toEqual([]);
});
it('MultiPolygon의 분리된 면과 구멍을 보존한다', async () => {
  const ring = [
    [127, 37],
    [128, 37],
    [128, 38],
    [127, 37],
  ];
  const polygons = parseAdminBoundary({ type: 'MultiPolygon', coordinates: [[ring, ring], [ring]] });
  expect(polygons).toHaveLength(2);
  expect(polygons[0]).toHaveLength(2);
});
it.each(['Point', 'LineString'])('%s 경계는 거절한다', async (type) => {
  expect(() => parseAdminBoundary({ type, coordinates: [] })).toThrow();
});
it('닫히지 않은 링은 거절한다', async () => {
  expect(() =>
    parseAdminBoundary({
      type: 'Polygon',
      coordinates: [
        [
          [127, 37],
          [128, 37],
          [128, 38],
          [127, 38],
        ],
      ],
    }),
  ).toThrow();
});
it('정류장이 없거나 최소 시간과 집계 시간이 다르면 거절한다', async () => {
  respond({ ...commuteAreaFixtures[0], stations: [] });
  await expect(load()).rejects.toThrow();
  respond({ ...commuteAreaFixtures[0], commuteMinutes: 99 });
  await expect(load()).rejects.toThrow();
});
it('기관 코드만 다른 같은 버스정류장은 통근 시간이 짧은 하나만 남기고 반대 방향 정류장은 유지한다', async () => {
  const stop = (stopId: string, travelMinutes: number) => ({
    stopId,
    stopName: '화랑공원남편',
    latitude: 37.3953,
    longitude: 127.107,
    travelMinutes,
    direction: null,
  });
  respond({
    adminDongCode: '31023760',
    commuteMinutes: 5,
    stations: [
      stop('BS_TAGO_SEB206000538', 5),
      stop('BS_TAGO_GGB206000539', 5),
      stop('BS_TAGO_GGB206000538', 6),
      stop('RS_ACC1_S-2-0222', 7),
    ],
  });
  const result = await load();
  expect(result.areas[0].stations.map((station) => station.stopId)).toEqual([
    'BS_TAGO_SEB206000538',
    'BS_TAGO_GGB206000539',
    'RS_ACC1_S-2-0222',
  ]);
});
