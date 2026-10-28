// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, it } from 'vitest';

import { mapHandlers } from '@/app/mocks/handlers/mapHandlers';
import { setAuthentication } from '@/features/auth/model/authStore';
import { fetchNearbyAgencies } from '@/features/map/api/agencyApi';

import { server } from '../../../server';

const config = { apiBaseUrl: 'http://localhost:8080' };
const load = () => fetchNearbyAgencies(config, 37.5665, 126.978, 1000);
const envelope = (data: unknown) => HttpResponse.json({ code: 'SUCCESS', message: '성공', data });
const agency = {
  providerPlaceId: 'kakao:1',
  name: '판교 공인중개사',
  address: '경기 성남시 분당구 판교역로 1',
  latitude: 37.4066,
  longitude: 127.0908,
  distanceMeters: 250,
  phone: '031-123-4567',
  placeUrl: 'https://place.map.kakao.com/1',
};
const respond = (data: unknown) => server.use(http.get('*/api/maps/agencies', () => envelope(data)));

beforeEach(() => {
  server.use(...mapHandlers);
});

it('반경 안의 중개업소를 가까운 순으로 전화번호·상세 페이지와 함께 받는다', async () => {
  const result = await load();
  expect(result.radius).toBe(1000);
  expect(result.count).toBe(result.agencies.length);
  expect(result.agencies.map((item) => item.providerPlaceId)).toEqual(['demo-agency-2', 'demo-agency-1']);
  expect(result.agencies[0].phone).toBe('02-2345-6789');
  expect(result.agencies[0].placeUrl).toBe('https://place.map.kakao.com/demo-agency-2');
});

it('다른 지도 조회처럼 회원 인증 헤더와 좌표·반경을 보낸다', async () => {
  setAuthentication({ accessToken: 'mock', tokenType: 'Bearer', expiresIn: 3600 });
  let authorization: string | null = 'unobserved';
  let params: URLSearchParams | null = null;
  server.use(
    http.get('*/api/maps/agencies', ({ request }) => {
      authorization = request.headers.get('Authorization');
      params = new URL(request.url).searchParams;
      return envelope({ center: { latitude: 37.5665, longitude: 126.978 }, radius: 1000, count: 0, agencies: [] });
    }),
  );
  await load();
  expect(authorization).toBe('Bearer mock');
  expect(params!.get('latitude')).toBe('37.5665');
  expect(params!.get('longitude')).toBe('126.978');
  expect(params!.get('radius')).toBe('1000');
});

it('전화번호와 상세 페이지가 없는 중개업소는 null로 받는다', async () => {
  respond({
    center: { latitude: 37.5665, longitude: 126.978 },
    radius: 1000,
    count: 1,
    agencies: [{ ...agency, phone: null, placeUrl: null, address: '' }],
  });
  const result = await load();
  expect(result.agencies[0]).toMatchObject({ phone: null, placeUrl: null, address: '' });
});

it.each([
  ['반경이 요청과 다르면', { radius: 500 }],
  ['개수가 목록과 다르면', { count: 2 }],
  ['상세 페이지가 http(s) 주소가 아니면', { agencies: [{ ...agency, placeUrl: 'javascript:alert(1)' }] }],
  ['같은 중개업소가 두 번 오면', { count: 2, agencies: [agency, agency] }],
])('%s 거절한다', async (_label, patch) => {
  respond({ center: { latitude: 37.5665, longitude: 126.978 }, radius: 1000, count: 1, agencies: [agency], ...patch });
  await expect(load()).rejects.toThrow();
});
