import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { fn } from 'storybook/test';

import type { ChecklistStage } from '@/features/checklist/model/checklistTypes';
import type {
  PropertyChecklistProgress,
  PropertyChecklistStageSummary,
  PropertySummary,
} from '@/features/property/model/Property';

import CompareTable from './CompareTable';

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
  onSite: [number, number] | null,
  preContract: [number, number] | null = null,
): PropertySummary => ({
  propertyId,
  name,
  depositAmount,
  monthlyRentAmount,
  discoverySource: { type: source.startsWith('http') ? 'URL' : 'TEXT', value: source },
  location: { address: null, latitude: null, longitude: null },
  representativePhoto: null,
  progress: onSite ? progress(onSite[0], onSite[1]) : progress(0, 0),
  stages: [stage(propertyId, 'ON_SITE', onSite), stage(propertyId, 'PRE_CONTRACT', preContract)],
  photoCount: 0,
});

const properties = [
  property(1, '역삼역 햇살 원룸', 10_000_000, 650_000, '직방', [8, 12]),
  property(2, '홍대 투룸 복층', 20_000_000, 850_000, '네이버 부동산', [12, 12], [3, 10]),
  property(3, '신림 오피스텔', 10_000_000, 650_000, '', null),
  property(4, '판교역 신축 원룸', 10_000_000, 900_000, 'https://www.dabangapp.com/room/123', [2, 12]),
  property(5, '건대입구 반지하 원룸', 3_000_000, 400_000, '지인 소개', null),
  property(6, '왕십리 오피스텔', 5_000_000, 700_000, '다방', [12, 12], [10, 10]),
];

const meta = {
  title: '페이지/방 비교/공통/CompareTable',
  component: CompareTable,
  args: {
    properties,
    selectedIds: [1, 2],
    maxSelection: 5,
    onToggle: fn(),
    previewId: undefined,
    onPreview: fn(),
  },
  argTypes: {
    properties: { control: false },
    selectedIds: { control: 'object', description: '고른 매물 번호 목록' },
    maxSelection: {
      control: { type: 'range', min: 1, max: 6, step: 1 },
      description: '최대로 고를 수 있는 매물 수. 다 고르면 나머지 줄을 막는다.',
    },
    onToggle: { description: '줄을 누르면 그 매물 번호로 부른다.' },
  },
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof CompareTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const MaxSelected: Story = {
  args: {
    selectedIds: [1, 2, 3, 4, 5],
  },
};

export const NoResult: Story = {
  args: {
    properties: [],
    selectedIds: [],
  },
};
