import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { useState } from 'react';

import WheelPicker from './WheelPicker';

const meta = {
  title: '공통/WheelPicker',
  component: WheelPicker,
  args: {
    label: '통근 시간',
    value: 60,
    options: Array.from({ length: 6 }, (_, index) => ({
      value: (index + 1) * 10,
      label: `${(index + 1) * 10}분 이내`,
    })),
    onValueChange: () => {},
  },
} satisfies Meta<typeof WheelPicker>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  render: function Controlled(args) {
    const [value, setValue] = useState(args.value);
    return <WheelPicker {...args} value={value} onValueChange={setValue} />;
  },
};
