import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { fn } from 'storybook/test';

import type { NearbyCategorySummary } from '@/features/map/lib/nearbySummary';

import NearbyRing from './NearbyRing';

const summary: NearbyCategorySummary[] = [
  { category: 'TRANSPORT', count: 6, capped: false, nearestMeters: 90 },
  { category: 'CONVENIENCE', count: 9, capped: false, nearestMeters: 120 },
  { category: 'HOSPITAL', count: 4, capped: false, nearestMeters: 250 },
  { category: 'AGENCY', count: 45, capped: true, nearestMeters: 60 },
];

const meta = {
  title: '페이지/매물 상세/NearbyRing',
  component: NearbyRing,
  args: {
    summary,
    focused: null,
    onFocus: fn(),
  },
  argTypes: {
    summary: { control: 'object', description: '시설마다 개수, 잘림 여부, 가장 가까운 거리. 정해 둔 순서로 넘긴다.' },
    focused: {
      control: 'select',
      options: [null, 'TRANSPORT', 'CONVENIENCE', 'HOSPITAL', 'AGENCY'],
      description: '범례에서 고른 시설. 고르면 나머지 줄을 흐리게 한다.',
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '22rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NearbyRing>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 범례에서 편의점을 골랐을 때. 다른 줄은 흐려진다. */
export const Focused: Story = {
  args: { focused: 'CONVENIENCE' },
};

/** 시설이 한 종류뿐이면 고리를 조각 없이 한 바퀴로 채운다. 없는 시설 줄은 누를 수 없다. */
export const SingleCategory: Story = {
  args: {
    summary: summary.map((item) =>
      item.category === 'CONVENIENCE' ? item : { ...item, count: 0, capped: false, nearestMeters: null },
    ),
  },
};
