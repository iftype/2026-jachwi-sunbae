import type { Meta, StoryObj } from '@storybook/react-webpack5';

import { propertyQueryKeys } from '@/features/property/api/propertyQueryKeys';
import type { PropertyChecklistProgress, PropertyPage, PropertySummary } from '@/features/property/model/Property';

import HomeMobilePage from './HomeMobilePage';

const emptyProgress: PropertyChecklistProgress = {
  totalCount: 0,
  completedCount: 0,
  goodCount: 0,
  cautionCount: 0,
  unconfirmedCount: 0,
  progressRate: 0,
};

const room = (
  propertyId: number,
  name: string,
  depositAmount: number,
  monthlyRentAmount: number,
  address: string | null,
): PropertySummary => ({
  propertyId,
  name,
  depositAmount,
  monthlyRentAmount,
  discoverySource: { type: 'TEXT', value: '직방' },
  location: { address, latitude: null, longitude: null },
  representativePhoto: null,
  progress: emptyProgress,
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

const rooms = [
  room(1, '역삼역 햇살 원룸', 10_000_000, 650_000, '서울 강남구 역삼동 823-12'),
  room(2, '홍대 투룸 복층', 20_000_000, 850_000, '서울 마포구 서교동 395-7'),
  room(3, '신림 오피스텔', 10_000_000, 650_000, '서울 관악구 신림동 1422-5'),
  room(4, '망원동 분리형 원룸', 5_000_000, 550_000, '서울 마포구 망원동 412-3'),
];

/** 휴대폰 홈은 홈 전용 헤더를 그린다. 최근 기록은 매물 목록 캐시로 채운다. */
const meta = {
  title: '페이지/홈/휴대폰/HomeMobilePage',
  component: HomeMobilePage,
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    layout: 'fullscreen',
    queryData: [[propertyQueryKeys.list(''), listData(rooms)]],
  },
} satisfies Meta<typeof HomeMobilePage>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 본 방 기록이 있어 최근 기록한 방이 보인다. */
export const Default: Story = {};

/** 아직 기록한 방이 없어 미리보기 매물 카드와 방 기록하기 버튼이 보인다. */
export const Empty: Story = {
  parameters: {
    queryData: [[propertyQueryKeys.list(''), listData([])]],
  },
};
