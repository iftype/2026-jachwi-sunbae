import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { MemoryRouter } from 'react-router-dom';

import Icon from '../icon/Icon';
import { Button, ButtonLink } from './Button';

const meta = {
  title: '공통/Button',
  component: Button,
  args: {
    children: '저장하기',
    variant: 'primary',
    fullWidth: false,
    isLoading: false,
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'soft', 'secondary', 'neutral', 'danger', 'text'],
    },
    fullWidth: { control: 'boolean' },
    isLoading: { control: 'boolean' },
  },
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Loading: Story = {
  args: {
    isLoading: true,
    loadingLabel: '저장 중…',
  },
};

export const Danger: Story = {
  args: {
    children: '삭제하기',
    variant: 'danger',
  },
};

export const Link: Story = {
  render: ({ children, variant, fullWidth }) => (
    <MemoryRouter initialEntries={['/']}>
      <ButtonLink to="/" variant={variant} fullWidth={fullWidth}>
        <Icon name="plus" size={15} />
        {children}
      </ButtonLink>
    </MemoryRouter>
  ),
  args: {
    children: '매물 목록으로 이동',
    variant: 'secondary',
  },
};
