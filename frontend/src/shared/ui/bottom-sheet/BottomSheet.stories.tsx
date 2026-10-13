import type { Meta, StoryObj } from '@storybook/react-webpack5';

import BottomSheet from './BottomSheet';

import styles from './BottomSheet.stories.module.css';

const meta = {
  title: '공통/BottomSheet',
  component: BottomSheet,
  args: { title: '상세 정보', children: <p>손잡이를 올리거나 눌러 패널 높이를 바꿀 수 있어요.</p>, onClose: () => {} },
  render: (args) => (
    <div className={styles.canvas}>
      <BottomSheet {...args} />
    </div>
  ),
} satisfies Meta<typeof BottomSheet>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
