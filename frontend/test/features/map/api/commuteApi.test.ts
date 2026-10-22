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
const respond = (area: unknown) =>
  server.use(
    http.get('*/api/commute-areas', () =>
      HttpResponse.json({ code: 'SUCCESS', message: '성공', data: { maxMinutes: 40, areaCount: 1, areas: [area] } }),
    ),
  );
it('서버의 행정동 코드·정류장을 파싱하고 가격·환승·경계를 가정하지 않는다', async () => {
  const result = await load();
  const region = commuteAreaToRegion(result.areas[0]);
  expect(region.polygons).toEqual([]);
  expect(region.summary).toEqual({ travel: '3분' });
  expect(result.areas[0].stations[1].direction).toBe('북동');
  expect(result.areas.every((area) => /^\d{8}$/.test(area.adminDongCode))).toBe(true);
});
it('로그인 상태여도 공개 조회에 인증 헤더를 보내지 않고 요청 조건을 전달한다', async () => {
  setAuthentication({ accessToken: 'mock', tokenType: 'Bearer', expiresIn: 3600 });
  let authorization: string | null = 'unobserved';
  let transfers: string | null = null;
  server.use(
    http.get('*/api/commute-areas', ({ request }) => {
      authorization = request.headers.get('Authorization');
      transfers = new URL(request.url).searchParams.get('maxTransfers');
      return HttpResponse.json({
        code: 'SUCCESS',
        message: '성공',
        data: { maxMinutes: 40, areaCount: 1, areas: [commuteAreaFixtures[0]] },
      });
    }),
  );
  await fetchCommuteAreas(config, { latitude: 37.5, longitude: 127.03 }, 40, 1);
  expect(authorization).toBeNull();
  expect(transfers).toBe('1');
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
