import type { Meta, StoryObj } from '@storybook/react-webpack5';

import ProgressCircle from './ProgressCircle';

const meta = {
  title: '공통/ProgressCircle',
  component: ProgressCircle,
  args: { size: 40, label: '로딩 중' },
} satisfies Meta<typeof ProgressCircle>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Small: Story = { args: { size: 24 } };
