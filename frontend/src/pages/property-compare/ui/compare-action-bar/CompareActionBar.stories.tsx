import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { fn } from 'storybook/test';

import CompareActionBar from './CompareActionBar';

const meta = {
  title: '페이지/방 비교/공통/CompareActionBar',
  component: CompareActionBar,
  args: {
    selectedCount: 3,
    isExporting: false,
    onDownload: fn(),
  },
  argTypes: {
    selectedCount: {
      control: { type: 'range', min: 0, max: 5, step: 1 },
      description: '고른 매물 수. 하나도 고르지 않으면 내려받기를 막는다.',
    },
    isExporting: { description: '비교표 이미지를 만드는 중인지' },
    onDownload: { description: '비교표 내려받기 버튼을 누르면 부른다.' },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '24rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CompareActionBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Ready: Story = {};

export const NeedMoreSelection: Story = {
  args: {
    selectedCount: 0,
  },
};

/** 하나만 골라도 그 매물 기록을 PDF로 받는다. */
export const SingleSelection: Story = {
  args: {
    selectedCount: 1,
  },
};

export const Exporting: Story = {
  args: {
    isExporting: true,
  },
};
