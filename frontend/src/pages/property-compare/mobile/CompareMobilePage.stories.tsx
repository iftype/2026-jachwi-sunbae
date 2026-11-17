import type { Meta, StoryObj } from '@storybook/react-webpack5';

import type { ChecklistStage } from '@/features/checklist/model/checklistTypes';
import { propertyQueryKeys } from '@/features/property/api/propertyQueryKeys';
import type {
  PropertyChecklistProgress,
  PropertyChecklistStageSummary,
  PropertyPage,
  PropertySummary,
} from '@/features/property/model/Property';

import CompareMobilePage from './CompareMobilePage';

const progress = (completedCount: number, totalCount: number): PropertyChecklistProgress => ({
  totalCount,
  completedCount,
  goodCount: completedCount,
  cautionCount: 0,
  unconfirmedCount: totalCount - completedCount,
  progressRate: totalCount === 0 ? 0 : Math.floor((completedCount / totalCount) * 100),
});

const stage = (
  propertyId: number,
  name: ChecklistStage,
  counts: [number, number] | null,
): PropertyChecklistStageSummary => ({
  stage: name,
  applied: counts !== null,
  propertyChecklistId: counts ? propertyId * 10 + (name === 'ON_SITE' ? 1 : 2) : null,
  checklistName: counts ? (name === 'ON_SITE' ? '현장 체크리스트' : '계약 전 체크리스트') : null,
  sourceChecklistId: counts ? 1 : null,
  progress: counts ? progress(counts[0], counts[1]) : progress(0, 0),
});

const property = (
  propertyId: number,
  name: string,
  depositAmount: number,
  monthlyRentAmount: number,
  source: string,
  address: string | null,
  onSite: [number, number] | null,
  preContract: [number, number] | null = null,
): PropertySummary => ({
  propertyId,
  name,
  depositAmount,
  monthlyRentAmount,
  discoverySource: { type: source.startsWith('http') ? 'URL' : 'TEXT', value: source },
  location: { address, latitude: null, longitude: null },
  representativePhoto: null,
  progress: onSite ? progress(onSite[0], onSite[1]) : progress(0, 0),
  stages: [stage(propertyId, 'ON_SITE', onSite), stage(propertyId, 'PRE_CONTRACT', preContract)],
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
  property(1, '역삼역 햇살 원룸', 10_000_000, 650_000, '직방', '서울 강남구 역삼동 823-12', [8, 12]),
  property(2, '홍대 투룸 복층', 20_000_000, 850_000, '네이버 부동산', '서울 마포구 서교동 395-7', [12, 12], [3, 10]),
  property(3, '신림 오피스텔', 10_000_000, 650_000, '', '서울 관악구 신림동 1422-5', null),
  property(4, '판교역 신축 원룸', 10_000_000, 900_000, 'https://www.dabangapp.com/room/123', null, [2, 12]),
  property(5, '건대입구 반지하 원룸', 3_000_000, 400_000, '지인 소개', '서울 광진구 화양동 5-12', null),
  property(6, '왕십리 오피스텔', 5_000_000, 700_000, '다방', '서울 성동구 행당동 192-1', [12, 12], [10, 10]),
];

/** 휴대폰 비교할 매물 선택. 이어진 리스트에서 1~5개를 골라 PDF로 받는다. 매물 목록 캐시로 채운다. */
const meta = {
  title: '페이지/방 비교/휴대폰/CompareMobilePage',
  component: CompareMobilePage,
  globals: { viewport: { value: 'mobile', isRotated: false } },
  parameters: {
    layout: 'fullscreen',
    route: '/compare',
    queryData: [[propertyQueryKeys.list(''), listData(properties)]],
  },
} satisfies Meta<typeof CompareMobilePage>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 비교할 매물이 여러 개 있다. */
export const Default: Story = {};

/** 매물이 하나뿐이어도 그 매물을 골라 PDF로 받을 수 있다. */
export const SingleProperty: Story = {
  parameters: {
    queryData: [[propertyQueryKeys.list(''), listData(properties.slice(0, 1))]],
  },
};

/** 등록한 매물이 없어 빈 화면 안내를 보인다. */
export const Empty: Story = {
  parameters: {
    queryData: [[propertyQueryKeys.list(''), listData([])]],
  },
};
