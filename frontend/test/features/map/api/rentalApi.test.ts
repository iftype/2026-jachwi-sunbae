// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, it } from 'vitest';

import { rentalHandlers } from '@/app/mocks/handlers/rentalHandlers';
import { resetAuthenticationForTests, setAuthentication } from '@/features/auth/model/authStore';
import { legalApiCode, nearbyLegalBoundaries } from '@/features/map/api/legalBoundaryApi';
import { fetchRentalAverage } from '@/features/map/api/rentalApi';

import { server } from '../../../server';

beforeEach(() => {
  setAuthentication({ accessToken: 'mock', tokenType: 'Bearer', expiresIn: 3600 });
  server.use(...rentalHandlers);
});
it('읍면동 8자리만 00을 붙이며 리 코드는 유지한다', () => {
  expect(legalApiCode('41210104')).toBe('4121010400');
  expect(legalApiCode('4159325023')).toBe('4159325023');
  expect(() => legalApiCode('11230')).toThrow();
});
it('100건을 넘는 거래도 다음 페이지까지 모두 평균에 포함한다', async () => {
  const result = await fetchRentalAverage({ apiBaseUrl: 'http://localhost:8080' }, '4121010400');
  expect(result.items).toHaveLength(105);
  expect(result.average).toBe(result.items.reduce((sum, item) => sum + item.monthlyRentAmountKrw, 0) / 105);
});
it('월세 평균 조회는 토큰 없이도 호출한다', async () => {
  resetAuthenticationForTests();
  const result = await fetchRentalAverage({ apiBaseUrl: 'http://localhost:8080' }, '4121010400');
  expect(result.items).toHaveLength(105);
});
it('빈 거래는 0원이 아닌 null이다', async () => {
  const result = await fetchRentalAverage({ apiBaseUrl: 'http://localhost:8080' }, '1100000000');
  expect(result.average).toBeNull();
});
it('누락된 페이지를 평균으로 잘못 표시하지 않는다', async () => {
  server.use(
    http.get('*/api/rental-transactions', () =>
      HttpResponse.json({
        code: 'SUCCESS',
        message: '성공',
        data: {
          legalDongCode: '4121010400',
          page: 0,
          hasNext: false,
          collectedAt: null,
          totalCount: 1,
          queryStartDate: '2026-04-13',
          queryEndDate: '2026-10-13',
          items: [],
        },
      }),
    ),
  );
  await expect(fetchRentalAverage({ apiBaseUrl: 'http://localhost:8080' }, '4121010400')).rejects.toThrow();
});
it('3km 바깥 지역을 제외하고 가까운 최대 다섯 곳만 선택한다', () => {
  const boundaries = Array.from({ length: 8 }, (_, index) => ({
    legalDongCode: `${index}`,
    name: '',
    fullName: '',
    center: { latitude: 37 + index * 0.01, longitude: 127 },
    polygons: [],
  }));
  expect(nearbyLegalBoundaries(boundaries, { latitude: 37, longitude: 127 })).toHaveLength(3);
});
