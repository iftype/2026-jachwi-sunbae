import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { fn } from 'storybook/test';

import { DEFAULT_COMPARE_FILTERS } from '../../lib/compareFilters';
import CompareFilters from './CompareFilters';

const meta = {
  title: '페이지/방 비교/공통/CompareFilters',
  component: CompareFilters,
  args: {
    filters: DEFAULT_COMPARE_FILTERS,
    resultCount: 6,
    onChange: fn(),
  },
  argTypes: {
    filters: {
      control: 'object',
      description: '월세 상한(rentLimit: 50 | 70 | 100 | null)·체크리스트(checklist: all | started | notStarted)',
    },
    resultCount: {
      control: { type: 'range', min: 0, max: 20, step: 1 },
      description: '필터에 맞는 매물 수',
    },
    onChange: { description: '필터를 바꾸면 바뀐 필터 전체로 부른다.' },
  },
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof CompareFilters>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filtered: Story = {
  args: {
    filters: { rentLimit: 70, checklist: 'started' },
    resultCount: 2,
  },
};

export const NoResult: Story = {
  args: {
    filters: { rentLimit: 50, checklist: 'notStarted' },
    resultCount: 0,
  },
};
