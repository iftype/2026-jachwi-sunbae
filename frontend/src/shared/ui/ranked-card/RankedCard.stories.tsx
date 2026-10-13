import type { Meta, StoryObj } from '@storybook/react-webpack5';

import RankedCard from './RankedCard';

import styles from './RankedCard.stories.module.css';

const meta = {
  title: '공통/RankedCard',
  component: RankedCard,
  parameters: { layout: 'padded' },
  args: { rank: 1, title: '역삼1동', value: 3, unit: '분', description: '역삼역에서 출발', onSelect: () => {} },
  argTypes: { rank: { control: { type: 'select' }, options: [1, 2, 3, 4, 5] } },
} satisfies Meta<typeof RankedCard>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Selected: Story = { args: { selected: true } };
export const Price: Story = {
  args: { rank: 2, title: '신림동', value: 55, unit: '만원', description: '월세 참고 가격' },
};
export const Disabled: Story = { args: { disabled: true } };
export const AllRanks: Story = {
  render: (args) => (
    <div className={styles.row}>
      {([1, 2, 3, 4, 5] as const).map((rank) => (
        <RankedCard key={rank} {...args} rank={rank} />
      ))}
    </div>
  ),
};
