// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { successEnvelope } from '@/app/mocks/fixtures/propertyFixtures';
import { setAuthentication } from '@/features/auth/model/authStore';
import {
  fetchNearby,
  reverseGeocode,
  searchAddress,
  searchAddressWithNaver,
  searchPlacesAndAddresses,
} from '@/features/map/api/mapApi';
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

  it('동네 찾기와 동네 검색의 네이버 검색은 별도 경로로 건물명 검색어를 보낸다', async () => {
    authenticate();
    const result = {
      roadAddress: '서울특별시 송파구 위례성대로 2',
      jibunAddress: '서울특별시 송파구 방이동 44-2',
      latitude: 37.5165,
      longitude: 127.1123,
    };
    server.use(
      http.get(`${config.apiBaseUrl}/api/maps/search`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('query')).toBe('우아한형제들');
        return HttpResponse.json(successEnvelope([result]));
      }),
    );

    await expect(searchAddressWithNaver(config, '우아한형제들')).resolves.toEqual([
      { address: result.roadAddress, ...result },
    ]);
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
  describe('searchPlacesAndAddresses', () => {
    const road = { roadAddress: '서울 강남구 학동로7길 34', jibunAddress: null, latitude: 37.51, longitude: 127.03 };
    const place = { roadAddress: '서울 강남구 신사동', jibunAddress: null, latitude: 37.52, longitude: 127.02 };
    const mock = (geocode: () => Response | Promise<Response>, search: () => Response | Promise<Response>) => {
      authenticate();
      server.use(
        http.get(`${config.apiBaseUrl}/api/maps/geocode`, geocode),
        http.get(`${config.apiBaseUrl}/api/maps/search`, search),
      );
    };
    const ok = (data: unknown[]) => () => HttpResponse.json(successEnvelope(data));
    const fail = () => HttpResponse.json({ code: 'MAP_PROVIDER_UNAVAILABLE' }, { status: 502 });

    it('장소명은 geocode가 502여도 search 결과를 돌려준다', async () => {
      mock(fail, ok([place]));
      await expect(searchPlacesAndAddresses(config, '신사')).resolves.toHaveLength(1);
    });
    it('도로명 주소는 search가 비어도 geocode 결과를 돌려준다', async () => {
      mock(ok([road]), ok([]));
      await expect(searchPlacesAndAddresses(config, road.roadAddress)).resolves.toHaveLength(1);
    });
    it('둘 다 결과가 있으면 search 먼저, 중복은 뺀다', async () => {
      mock(ok([road, place]), ok([place]));
      const found = await searchPlacesAndAddresses(config, '강남');
      expect(found.map((item) => item.roadAddress)).toEqual([place.roadAddress, road.roadAddress]);
    });
    it('둘 다 실패하면 오류로 던진다', async () => {
      mock(fail, fail);
      await expect(searchPlacesAndAddresses(config, '신사')).rejects.toThrow();
    });
    it('둘 다 성공했지만 비어 있으면 빈 배열이다', async () => {
      mock(ok([]), ok([]));
      await expect(searchPlacesAndAddresses(config, '없음')).resolves.toEqual([]);
    });
  });
});
