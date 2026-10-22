// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { successEnvelope } from '@/app/mocks/fixtures/propertyFixtures';
import { setAuthentication } from '@/features/auth/model/authStore';
import { fetchNearby, reverseGeocode, searchAddress } from '@/features/map/api/mapApi';
import type { PublicConfig } from '@/shared/config/publicConfigTypes';

import { server } from '../../../server';

const config: PublicConfig = {
  apiBaseUrl: 'http://localhost:8080',
  mapProviderMode: 'demo',
};

const authenticate = () => setAuthentication({ accessToken: 'demo-token', tokenType: 'Bearer', expiresIn: 60 });

describe('MVP2 지도 API', () => {
  it('주소 검색과 역지오코딩에서 도로명·지번·좌표를 보존한다', async () => {
    authenticate();
    const result = {
      roadAddress: '서울 중구 세종대로 110',
      jibunAddress: '서울 중구 태평로1가 31',
      latitude: 37.5665,
      longitude: 126.978,
    };
    server.use(
      http.get(`${config.apiBaseUrl}/api/maps/geocode`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('query')).toBe('서울 시청');
        return HttpResponse.json(successEnvelope([result]));
      }),
      http.get(`${config.apiBaseUrl}/api/maps/reverse-geocode`, ({ request }) => {
        expect(Object.fromEntries(new URL(request.url).searchParams)).toEqual({
          latitude: '37.5665',
          longitude: '126.978',
        });
        return HttpResponse.json(successEnvelope(result));
      }),
    );

    await expect(searchAddress(config, '서울 시청')).resolves.toEqual([{ address: result.roadAddress, ...result }]);
    await expect(reverseGeocode(config, 37.5665, 126.978)).resolves.toEqual({
      address: result.roadAddress,
      ...result,
    });
  });

  it('주변 시설 집계와 장소를 반경·카테고리 요청으로 읽는다', async () => {
    authenticate();
    server.use(
      http.get(`${config.apiBaseUrl}/api/maps/nearby`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        expect(params.get('radius')).toBe('1000');
        expect(params.get('categories')).toBe('HOSPITAL,SCHOOL');
        return HttpResponse.json(
          successEnvelope({
            center: { latitude: 37.5665, longitude: 126.978 },
            radius: 1000,
            counts: { HOSPITAL: 1, SCHOOL: 0, CONVENIENCE: 0, AGENCY: 0 },
            places: [
              {
                providerPlaceId: 'demo-hospital-1',
                name: '서울시립병원',
                category: 'HOSPITAL',
                address: '서울 중구 세종대로 92',
                latitude: 37.567,
                longitude: 126.9785,
                distanceMeters: 320,
              },
            ],
          }),
        );
      }),
    );

    await expect(fetchNearby(config, 37.5665, 126.978, 1000, ['HOSPITAL', 'SCHOOL'])).resolves.toMatchObject({
      radius: 1000,
      counts: { HOSPITAL: 1, SCHOOL: 0 },
      places: [{ name: '서울시립병원', distanceMeters: 320 }],
    });
  });
});
