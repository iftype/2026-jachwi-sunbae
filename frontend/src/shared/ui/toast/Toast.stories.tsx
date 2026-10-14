import type { Meta, StoryObj } from '@storybook/react-webpack5';

import Toast from './Toast';

const meta = {
  title: '공통/Toast',
  component: Toast,
  args: {
    isOpen: true,
    title: '어디로 출퇴근·통학하세요?',
    description: '학교·회사 등 자주 가는 곳을 검색하거나\n지도에서 선택해주세요.',
    duration: 0,
    onClose: () => {},
  },
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', width: 'min(100%, 390px)', height: '220px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Toast>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
