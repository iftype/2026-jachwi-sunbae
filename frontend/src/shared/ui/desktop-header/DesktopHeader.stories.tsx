import type { Meta, StoryObj } from '@storybook/react-webpack5';

import DesktopHeader from './DesktopHeader';

const meta = {
  title: '공용/DesktopHeader',
  component: DesktopHeader,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof DesktopHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 메뉴에 있는 화면(동네 찾기)에 있으면 그 메뉴를 표시한다. */
export const ActiveMenu: Story = {
  parameters: {
    route: '/neighborhoods',
  },
};

/** 마이 화면에 있으면 프로필 버튼을 표시한다. */
export const ActiveProfile: Story = {
  parameters: {
    route: '/me',
  },
};
