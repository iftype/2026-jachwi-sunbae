import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { fn } from 'storybook/test';

import type { fetchBusStops } from '@/features/map/api/busStopApi';
import type { NearbyResult } from '@/features/map/model/Map';

import PropertyNearbyPreview from './PropertyNearbyPreview';

const center = { latitude: 37.4842, longitude: 126.9297 };
const API_BASE_URL = 'http://localhost:8080';

/** 매물 자리에서 북쪽으로 dy, 동쪽으로 dx(도)만큼 옮긴 표본 시설. */
const place = (
  id: string,
  name: string,
  category: NearbyResult['places'][number]['category'],
  dy: number,
  dx: number,
) => ({
  providerPlaceId: id,
  name,
  category,
  address: '서울 관악구 신림로',
  latitude: center.latitude + dy,
  longitude: center.longitude + dx,
  distanceMeters: Math.round(Math.hypot(dy * 111_000, dx * 88_000)),
});

const nearby: NearbyResult = {
  center,
  radius: 500,
  counts: { CONVENIENCE: 3, HOSPITAL: 2, SCHOOL: 1, AGENCY: 2 },
  places: [
    place('c1', '신림 편의점', 'CONVENIENCE', 0.001, 0.0008),
    place('c2', '역앞 편의점', 'CONVENIENCE', -0.0015, 0.002),
    place('c3', '골목 편의점', 'CONVENIENCE', 0.0025, -0.0012),
    place('h1', '신림 내과', 'HOSPITAL', -0.0008, -0.0018),
    place('h2', '관악 치과', 'HOSPITAL', 0.002, 0.0025),
    place('s1', '신림초등학교', 'SCHOOL', -0.003, 0.0005),
    place('a1', '행복공인중개사', 'AGENCY', 0.0005, -0.0004),
    place('a2', '신림공인중개사', 'AGENCY', -0.0012, 0.0011),
  ],
};

const busStops: Awaited<ReturnType<typeof fetchBusStops>> = {
  center,
  radius: 500,
  count: 2,
  busStops: [
    {
      nodeId: 'b1',
      name: '신림역 정류장',
      latitude: center.latitude + 0.0007,
      longitude: center.longitude,
      distanceMeters: 80,
    },
    {
      nodeId: 'b2',
      name: '신림시장 정류장',
      latitude: center.latitude - 0.002,
      longitude: center.longitude - 0.001,
      distanceMeters: 240,
    },
  ],
};

/** 주변 지도가 읽는 두 요청(시설, 정류장)의 캐시. 스토리는 서버에 묻지 않는다. */
const nearbyQueryData = (result: NearbyResult, stops: typeof busStops) => [
  [['nearby-facilities', API_BASE_URL, center.latitude, center.longitude, 500], result],
  [['bus-stops', API_BASE_URL, center.latitude, center.longitude, 500], stops],
];

const meta = {
  title: '페이지/매물 상세/PropertyNearbyPreview',
  component: PropertyNearbyPreview,
  args: {
    propertyId: 10,
    ...center,
    isEditingLocation: false,
    onSaveLocation: fn(() => Promise.resolve()),
    onEndEditLocation: fn(),
  },
  argTypes: {
    latitude: { control: false, description: '매물 위도. 표본 캐시가 이 좌표 기준이라 고정한다.' },
    longitude: { control: false, description: '매물 경도. 표본 캐시가 이 좌표 기준이라 고정한다.' },
    isEditingLocation: { description: '켜면 매물 핀을 지우고 지도를 눌러 새 위치를 고른다.' },
  },
  parameters: {
    queryData: nearbyQueryData(nearby, busStops),
  },
  decorators: [
    (Story) => (
      <div style={{ width: '24rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PropertyNearbyPreview>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 500m 안에서 시설을 하나도 찾지 못했을 때. 고리 대신 한 줄 안내를 둔다. */
export const NoFacilities: Story = {
  parameters: {
    queryData: nearbyQueryData(
      { ...nearby, counts: { CONVENIENCE: 0, HOSPITAL: 0, SCHOOL: 0, AGENCY: 0 }, places: [] },
      { ...busStops, count: 0, busStops: [] },
    ),
  },
};

/** 주소 수정을 눌러 이 지도에서 새 위치를 고르는 중. 지도를 누르면 아래 안내에 주소가 뜬다. */
export const EditingLocation: Story = {
  args: { isEditingLocation: true },
};
