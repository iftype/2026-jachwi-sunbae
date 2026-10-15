import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { MemoryRouter } from 'react-router-dom';

import iconHome from '@/shared/assets/illustrations/icon-home.webp';

import ShortcutTile from './ShortcutTile';

// to/onClick 유니언 props라 satisfies 대신 타입을 직접 지정한다.
const meta: Meta<typeof ShortcutTile> = {
  title: '공통/ShortcutTile',
  component: ShortcutTile,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div style={{ width: '5rem' }}>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  args: { label: '홈', icon: iconHome, to: '/' },
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof ShortcutTile>;

export const Default: Story = {};
export const LongLabel: Story = { args: { label: '자주 쓰는 체크리스트 모아보기' } };
