/**
 * 버스정류장·공인중개사 목 데이터. 조회 중심을 기준으로 매번 흩어 놓으면 지도를 옮길 때 마커가 화면을 따라오므로,
 * 실제 서버처럼 정해진 좌표에 두고 조회 반경 안에 든 것만 돌려준다.
 * 동네 찾기 목 결과(역삼1동·신림동·정자동)와 기본 목적지(판교), 기존 목 기준점(서울시청) 주변에 둔다.
 */
const EARTH_METERS_PER_DEGREE = 111_320;

/** 기준점에서 거리·방향(0~7, 45도 단위)만큼 떨어진 좌표. 목 데이터를 만들 때 한 번만 계산한다. */
const offset = (
  hub: { latitude: number; longitude: number },
  distanceMeters: number,
  direction: number,
): { latitude: number; longitude: number } => {
  const angle = (direction * Math.PI) / 4;
  const degrees = distanceMeters / EARTH_METERS_PER_DEGREE;
  return {
    latitude: hub.latitude + degrees * Math.cos(angle),
    longitude: hub.longitude + (degrees * Math.sin(angle)) / Math.cos((hub.latitude * Math.PI) / 180),
  };
};

type Hub = { latitude: number; longitude: number; district: string };
const CITY_HALL: Hub = { latitude: 37.5665, longitude: 126.978, district: '서울 중구' };
const YEOKSAM: Hub = { latitude: 37.5007, longitude: 127.0365, district: '서울 강남구' };
const SILLIM: Hub = { latitude: 37.4842, longitude: 126.9297, district: '서울 관악구' };
const JEONGJA: Hub = { latitude: 37.367, longitude: 127.1084, district: '경기 성남시 분당구' };
const PANGYO: Hub = { latitude: 37.395, longitude: 127.111, district: '경기 성남시 분당구' };

export type FixedBusStop = { nodeId: string; name: string; latitude: number; longitude: number };
export type FixedAgency = {
  providerPlaceId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  placeUrl: string | null;
};

const stop = (hub: Hub, nodeId: string, name: string, distance: number, direction: number): FixedBusStop => ({
  nodeId,
  name,
  ...offset(hub, distance, direction),
});
const agency = (
  hub: Hub,
  providerPlaceId: string,
  name: string,
  street: string,
  distance: number,
  direction: number,
  phone: string | null,
  hasPlaceUrl = true,
): FixedAgency => ({
  providerPlaceId,
  name,
  address: `${hub.district} ${street}`,
  ...offset(hub, distance, direction),
  phone,
  placeUrl: hasPlaceUrl ? `https://place.map.kakao.com/${providerPlaceId}` : null,
});

export const fixedBusStops: FixedBusStop[] = [
  stop(CITY_HALL, 'demo-transport-1', '시청역', 280, 1),
  stop(CITY_HALL, 'demo-transport-2', '시청앞 버스정류장', 410, 7),
  stop(YEOKSAM, 'SEB121000101', '역삼역', 150, 2),
  stop(YEOKSAM, 'SEB121000102', '역삼역.포스코센터(북동)', 320, 1),
  stop(YEOKSAM, 'SEB121000103', '강남세브란스입구', 560, 4),
  stop(YEOKSAM, 'SEB121000104', '역삼초등학교', 430, 6),
  stop(SILLIM, 'SEB120000201', '신림역', 120, 0),
  stop(SILLIM, 'SEB120000202', '신림사거리', 300, 3),
  stop(SILLIM, 'SEB120000203', '관악구청입구', 520, 6),
  stop(JEONGJA, 'GGB206000301', '정자역', 110, 2),
  stop(JEONGJA, 'GGB206000302', '정자동주민센터', 380, 5),
  stop(JEONGJA, 'GGB206000303', '느티마을', 600, 7),
  stop(PANGYO, 'GGB206000683', '판교역남편', 140, 4),
  stop(PANGYO, 'GGB206000684', '판교역동편', 260, 2),
];

export const fixedAgencies: FixedAgency[] = [
  // 기존 목 응답·테스트와 같은 두 곳. 연락처는 백엔드 demo 공급자와 같다.
  agency(CITY_HALL, 'demo-agency-1', '자취선배 공인중개사', '다동길 8', 510, 6, '02-1234-5678'),
  agency(CITY_HALL, 'demo-agency-2', '세종대로 공인중개사', '세종대로 104', 260, 0, '02-2345-6789'),
  agency(YEOKSAM, 'demo-agency-yeoksam-1', '역삼역 공인중개사', '테헤란로 156', 200, 3, '02-555-1201'),
  agency(YEOKSAM, 'demo-agency-yeoksam-2', '강남 원룸 공인중개사', '논현로 85길 12', 380, 7, '02-555-1202'),
  agency(YEOKSAM, 'demo-agency-yeoksam-3', '역삼1동 부동산', '역삼로 120', 620, 5, null, false),
  agency(SILLIM, 'demo-agency-sillim-1', '신림역 공인중개사', '신림로 330', 180, 1, '02-877-2201'),
  agency(SILLIM, 'demo-agency-sillim-2', '관악 원룸 부동산', '남부순환로 1600', 420, 4, '02-877-2202'),
  agency(JEONGJA, 'demo-agency-jeongja-1', '정자역 공인중개사', '정자일로 210', 160, 0, '031-711-3301'),
  agency(JEONGJA, 'demo-agency-jeongja-2', '분당 오피스텔 공인중개사', '성남대로 343', 450, 3, null),
  agency(PANGYO, 'demo-agency-pangyo-1', '판교역 공인중개사', '판교역로 166', 220, 6, '031-701-4401'),
];
