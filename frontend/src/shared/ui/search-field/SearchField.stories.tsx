import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { useState } from 'react';

import SearchField from './SearchField';

const meta = {
  title: '공통/SearchField',
  component: SearchField,
  args: {
    label: '주소 검색',
    value: '',
    placeholder: '도로명 또는 지번 주소',
    onValueChange: () => undefined,
    onSubmit: () => undefined,
  },
  argTypes: { onSubmit: { action: 'submit search' }, onBack: { action: 'back' } },
} satisfies Meta<typeof SearchField>;
export default meta;
type Story = StoryObj<typeof meta>;
const ControlledSearch = (args: React.ComponentProps<typeof SearchField>) => {
  const [value, setValue] = useState(args.value);
  return <SearchField {...args} value={value} onValueChange={setValue} />;
};
export const Default: Story = { render: (args) => <ControlledSearch {...args} /> };
export const MapSearch: Story = {
  args: { shape: 'pill', showSubmitButton: false, onBack: () => undefined },
  render: (args) => <ControlledSearch {...args} />,
};
export const Disabled: Story = { args: { value: '서울시청', disabled: true } };
