// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, it } from 'vitest';

import { setAuthentication } from '@/features/auth/model/authStore';
import { fetchBusStops } from '@/features/map/api/busStopApi';

import { server } from '../../../server';

const config = { apiBaseUrl: 'http://localhost:8080' };
const stops = Array.from({ length: 80 }, (_, index) => ({
  nodeId: `GGB${index}`,
  name: `정류장 ${index}`,
  latitude: 37.5,
  longitude: 127,
  distanceMeters: index,
}));
const result = { center: { latitude: 37.5, longitude: 127 }, radius: 500, count: 80, busStops: stops };
beforeEach(() => setAuthentication({ accessToken: 'mock', tokenType: 'Bearer', expiresIn: 3600 }));
it('전용 API에 좌표·반경만 요청하고 80개 정류장을 제한 없이 읽는다', async () => {
  server.use(
    http.get('*/api/maps/bus-stops', ({ request }) => {
      const params = new URL(request.url).searchParams;
      expect(Object.fromEntries(params)).toEqual({ latitude: '37.5', longitude: '127', radius: '500' });
      return HttpResponse.json({ code: 'SUCCESS', message: '성공', data: result });
    }),
  );
  expect((await fetchBusStops(config, 37.5, 127, 500)).busStops).toHaveLength(80);
});
it.each([
  { ...result, count: 79 },
  { ...result, radius: 600 },
  { ...result, busStops: [...stops.slice(0, -1), stops[0]] },
  { ...result, busStops: [{ ...stops[0], distanceMeters: -1 }], count: 1 },
])('잘못된 반경·집계·중복 ID·거리는 성공으로 표시하지 않는다', async (data) => {
  server.use(http.get('*/api/maps/bus-stops', () => HttpResponse.json({ code: 'SUCCESS', message: '성공', data })));
  await expect(fetchBusStops(config, 37.5, 127, 500)).rejects.toThrow();
});
