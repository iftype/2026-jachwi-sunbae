import { http } from 'msw';

import { getMockProperties, success } from '../mockStore';

const address = {
  roadAddress: '서울 중구 세종대로 110',
  jibunAddress: '서울 중구 태평로1가 31',
  latitude: 37.5665,
  longitude: 126.978,
};

const EARTH_METERS_PER_DEGREE = 111_320;

/** 조회 중심에서 실제 거리만큼 떨어진 좌표를 만든다. 방향만 바꿔 서로 겹치지 않게 흩어 둔다. */
const at = (latitude: number, longitude: number, distanceMeters: number, direction: number) => {
  const angle = (direction * Math.PI) / 4;
  const degrees = distanceMeters / EARTH_METERS_PER_DEGREE;
  return {
    latitude: latitude + degrees * Math.cos(angle),
    longitude: longitude + (degrees * Math.sin(angle)) / Math.cos((latitude * Math.PI) / 180),
  };
};

type DemoPlace = {
  providerPlaceId: string;
  name: string;
  category: 'HOSPITAL' | 'TRANSPORT' | 'SCHOOL' | 'CONVENIENCE' | 'AGENCY';
  address: string;
  distanceMeters: number;
  direction: number;
};

const demoPlaces: DemoPlace[] = [
  ...Array.from({ length: 14 }, (_, index) => ({
    providerPlaceId: `demo-hospital-${index + 1}`,
    name: index === 0 ? '서울시립병원' : `도심 의원 ${index + 1}`,
    category: 'HOSPITAL' as const,
    address: `서울 중구 세종대로 ${92 + index}`,
    distanceMeters: 120 + index * 80,
    direction: index % 8,
  })),
  {
    providerPlaceId: 'demo-transport-1',
    name: '시청역',
    category: 'TRANSPORT',
    address: '서울 중구 세종대로 지하 101',
    distanceMeters: 280,
    direction: 1,
  },
  {
    providerPlaceId: 'demo-transport-2',
    name: '시청앞 버스정류장',
    category: 'TRANSPORT',
    address: '서울 중구 태평로1가',
    distanceMeters: 410,
    direction: 7,
  },
  {
    providerPlaceId: 'demo-school-1',
    name: '세종초등학교',
    category: 'SCHOOL',
    address: '서울 중구 세종대로 76',
    distanceMeters: 340,
    direction: 5,
  },
  {
    providerPlaceId: 'demo-school-2',
    name: '덕수초등학교',
    category: 'SCHOOL',
    address: '서울 중구 덕수궁길 140',
    distanceMeters: 830,
    direction: 4,
  },
  {
    providerPlaceId: 'demo-convenience-1',
    name: '모카 편의점',
    category: 'CONVENIENCE',
    address: '서울 중구 세종대로 100',
    distanceMeters: 180,
    direction: 3,
  },
  {
    providerPlaceId: 'demo-convenience-2',
    name: '24시 편의점',
    category: 'CONVENIENCE',
    address: '서울 중구 을지로 12',
    distanceMeters: 620,
    direction: 2,
  },
  {
    providerPlaceId: 'demo-agency-1',
    name: '자취선배 공인중개사',
    category: 'AGENCY',
    address: '서울 중구 다동길 8',
    distanceMeters: 510,
    direction: 6,
  },
  {
    providerPlaceId: 'demo-agency-2',
    name: '세종대로 공인중개사',
    category: 'AGENCY',
    address: '서울 중구 세종대로 104',
    distanceMeters: 260,
    direction: 0,
  },
];

export const mapHandlers = [
  http.get('*/api/maps/geocode', () => success([address])),
  http.get('*/api/maps/reverse-geocode', ({ request }) => {
    const url = new URL(request.url);
    const latitude = Number(url.searchParams.get('latitude') ?? address.latitude);
    const longitude = Number(url.searchParams.get('longitude') ?? address.longitude);
    const matched = getMockProperties().find(
      (property) =>
        property.latitude !== null &&
        property.longitude !== null &&
        Math.abs(property.latitude - latitude) < 0.001 &&
        Math.abs(property.longitude - longitude) < 0.001,
    );
    const label = matched?.address ?? `MSW 테스트 위치 (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`;
    return success({
      roadAddress: label,
      jibunAddress: label,
      latitude,
      longitude,
    });
  }),
  http.get('*/api/maps/nearby', ({ request }) => {
    const url = new URL(request.url);
    const radius = Number(url.searchParams.get('radius') ?? 2000);
    // 실제 백엔드처럼 조회 중심을 기준으로 돌려준다. 고정 좌표를 쓰면 지도를 옮겼을 때 핀이 화면 밖에 남는다.
    const latitude = Number(url.searchParams.get('latitude') ?? address.latitude);
    const longitude = Number(url.searchParams.get('longitude') ?? address.longitude);
    const categories = (url.searchParams.get('categories') ?? '').split(',').filter(Boolean);
    const places = demoPlaces
      .filter(
        (place) => place.distanceMeters <= radius && (categories.length === 0 || categories.includes(place.category)),
      )
      .map(({ direction, ...place }) => ({ ...place, ...at(latitude, longitude, place.distanceMeters, direction) }));
    const counts = { HOSPITAL: 0, TRANSPORT: 0, SCHOOL: 0, CONVENIENCE: 0, AGENCY: 0 };
    places.forEach((place) => {
      counts[place.category] += 1;
    });
    return success({ center: { latitude, longitude }, radius, counts, places });
  }),
];
