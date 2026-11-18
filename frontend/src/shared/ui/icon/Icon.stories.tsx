import type { Meta, StoryObj } from '@storybook/react-webpack5';

import type { IconName } from './Icon';
import Icon from './Icon';

const iconNames: IconName[] = [
  'plus',
  'map',
  'inbox',
  'search',
  'checklist',
  'home',
  'user',
  'edit',
  'trash',
  'close',
  'chevron-right',
  'chevron-left',
  'chevron-up',
  'chevron-down',
  'arrow-left',
  'arrow-right',
  'external-link',
  'link',
  'image',
  'sparkles',
  'info',
  'locate',
  'target',
  'refresh',
  'more-vertical',
];

const meta = {
  title: '공용/Icon',
  component: Icon,
  args: {
    name: 'plus',
    size: 24,
  },
  argTypes: {
    name: {
      control: 'select',
      options: iconNames,
      description: '그릴 아이콘 이름',
    },
    size: {
      control: { type: 'range', min: 12, max: 48, step: 2 },
      description: '가로·세로 크기(px). 색은 글자색(currentColor)을 따른다.',
    },
  },
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof Icon>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 모든 아이콘. `size` 컨트롤로 한꺼번에 크기를 바꿔 본다. */
export const Gallery: Story = {
  argTypes: {
    name: { control: false },
  },
  render: ({ size }) => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 5rem)',
        gap: '1rem',
        color: 'var(--color-ink)',
      }}
    >
      {iconNames.map((name) => (
        <div key={name} style={{ display: 'grid', justifyItems: 'center', gap: '0.35rem' }}>
          <Icon name={name} size={size} />
          <small>{name}</small>
        </div>
      ))}
    </div>
  ),
};
