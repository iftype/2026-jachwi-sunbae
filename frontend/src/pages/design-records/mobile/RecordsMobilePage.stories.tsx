import type { Meta, StoryObj } from '@storybook/react-webpack5';

import { propertyQueryKeys } from '@/features/property/api/propertyQueryKeys';
import type { PropertyChecklistProgress, PropertyPage, PropertySummary } from '@/features/property/model/Property';

import RecordsMobilePage from '../DesignRecordsPage';

const progress = (completedCount: number, totalCount: number): PropertyChecklistProgress => ({
  totalCount,
  completedCount,
  goodCount: completedCount,
  cautionCount: 0,
  unconfirmedCount: totalCount - completedCount,
  progressRate: totalCount === 0 ? 0 : Math.floor((completedCount / totalCount) * 100),
});

const property = (
  propertyId: number,
  name: string,
  depositAmount: number,
  monthlyRentAmount: number,
  address: string,
  latitude: number | null,
  longitude: number | null,
  checked: [number, number] = [0, 0],
): PropertySummary => ({
  propertyId,
  name,
  depositAmount,
  monthlyRentAmount,
  discoverySource: { type: 'TEXT', value: '직방' },
  location: { address, latitude, longitude },
  representativePhoto: null,
  progress: progress(checked[0], checked[1]),
  stages: [],
  photoCount: 0,
});

const listData = (content: PropertySummary[]): { pages: PropertyPage[]; pageParams: number[] } => ({
  pages: [
    {
      content,
      page: 0,
      size: 20,
      totalElements: content.length,
      totalPages: content.length === 0 ? 0 : 1,
      hasNext: false,
    },
  ],
  pageParams: [0],
});

const properties = [
  property(1, '삼평동 판교역 원룸', 10_000_000, 700_000, '경기 성남시 분당구 삼평동 680', 37.3948, 127.1112, [8, 12]),
  property(2, '백현동 투룸', 20_000_000, 900_000, '경기 성남시 분당구 백현동 541', 37.3896, 127.1076, [12, 12]),
  property(3, '이매동 오피스텔', 10_000_000, 700_000, '경기 성남시 분당구 이매동 125', 37.3955, 127.1275),
  property(4, '정자동 분리형 원룸', 5_000_000, 600_000, '경기 성남시 분당구 정자동 178', 37.3669, 127.1085, [3, 12]),
  property(5, '주소만 적은 매물', 5_000_000, 500_000, '서울 관악구 신림동', null, null),
];

/** 휴대폰 본 방 기록. 보기 방식(지도·리스트)은 주소의 `?view=`로 정한다. 기록 목록은 매물 목록 캐시로 채운다. */
const meta = {
  title: '페이지/본 방 기록/휴대폰/RecordsMobilePage',
  component: RecordsMobilePage,
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    layout: 'fullscreen',
    route: '/properties?view=map',
    queryData: [[propertyQueryKeys.list(''), listData(properties)]],
  },
} satisfies Meta<typeof RecordsMobilePage>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 지도 보기. 헤더와 동네 뱃지가 지도 위에 뜬다. */
export const MapView: Story = {};

/** 리스트 보기. 아래에 기록하기 버튼이 있다. */
export const ListView: Story = {
  parameters: {
    route: '/properties?view=list',
  },
};

/** 리스트 보기에서 아직 기록한 방이 없다. */
export const Empty: Story = {
  parameters: {
    route: '/properties?view=list',
    queryData: [[propertyQueryKeys.list(''), listData([])]],
  },
};
