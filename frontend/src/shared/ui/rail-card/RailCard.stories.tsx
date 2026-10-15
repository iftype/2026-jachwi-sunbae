import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { MemoryRouter } from 'react-router-dom';

import HorizontalRail from '../horizontal-rail/HorizontalRail';
import RailCard from './RailCard';

import styles from './RailCard.stories.module.css';

// to/onSelect 유니언 props라 satisfies 대신 타입을 직접 지정한다.
const meta: Meta<typeof RailCard> = {
  title: '공통/RailCard',
  component: RailCard,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <HorizontalRail aria-label="예시 레일">
          <Story />
        </HorizontalRail>
      </MemoryRouter>
    ),
  ],
  args: { className: styles.sample, children: '내용은 쓰는 쪽에서 그려요', onSelect: () => {} },
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof RailCard>;

export const Select: Story = {};
export const Selected: Story = { args: { selected: true } };
export const Disabled: Story = { args: { disabled: true } };
export const Navigate: Story = { args: { onSelect: undefined, to: '/properties/1' } };
