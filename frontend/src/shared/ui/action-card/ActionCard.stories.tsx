import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { MemoryRouter } from 'react-router-dom';

import iconMap from '@/shared/assets/illustrations/icon-map.webp';
import goose from '@/shared/assets/jachwi-sunbae-goose.webp';

import ActionCard, { ActionCardIllustration } from './ActionCard';

// to/onClick 유니언 props라 satisfies 대신 타입을 직접 지정한다.
const meta: Meta<typeof ActionCard> = {
  title: '공통/ActionCard',
  component: ActionCard,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div style={{ display: 'grid', width: '11rem', height: '11rem' }}>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  args: {
    title: '인프라 지도',
    description: '주변 교통과 편의시설을 살펴봐요',
    tone: 'neutral',
    size: 'medium',
    to: '/map',
    illustration: <ActionCardIllustration src={iconMap} width={192} height={192} />,
  },
  argTypes: {
    tone: { control: 'select', options: ['neutral', 'brand', 'informative'] },
    size: { control: 'select', options: ['medium', 'large'] },
  },
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof ActionCard>;

export const Neutral: Story = {};
export const Brand: Story = {
  args: { tone: 'brand', size: 'large', title: '매물 기록하기', description: '직접 본 매물을 기록해요' },
};
export const InformativePeek: Story = {
  args: {
    tone: 'informative',
    title: '사용방법 알아보기',
    description: undefined,
    illustration: <ActionCardIllustration src={goose} width={160} height={160} placement="peek" />,
  },
};
