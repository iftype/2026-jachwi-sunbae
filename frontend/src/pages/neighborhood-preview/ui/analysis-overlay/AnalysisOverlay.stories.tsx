import type { Meta, StoryObj } from '@storybook/react-webpack5';
import type { ComponentProps, ComponentType } from 'react';
import { fn } from 'storybook/test';

import AnalysisOverlay from './AnalysisOverlay';

/** `preview`에 든 값을 하나씩 컨트롤로 바꿔 보도록 펼쳐 둔다. 화면에는 다시 `preview`로 묶어 넘긴다. */
type StoryArgs = ComponentProps<typeof AnalysisOverlay>['preview'];

const meta = {
  title: '페이지/동네 찾기/공통/AnalysisOverlay',
  // 컨트롤은 preview를 펼친 값으로 받아 render에서 다시 묶는다. props 모양이 달라 타입만 맞춰 주고, 문서는 실제 컴포넌트에서 읽는다.
  component: AnalysisOverlay as unknown as ComponentType<StoryArgs>,
  parameters: {
    layout: 'fullscreen',
    controls: { exclude: ['preview', 'className', 'ref'] },
  },
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', height: '36rem', maxWidth: '26rem', background: '#e9ece8' }}>
        <Story />
      </div>
    ),
  ],
  render: (args) => <AnalysisOverlay preview={args} />,
  argTypes: {
    isAnalyzing: { description: '동네를 분석하는 중인지' },
    error: { control: 'text', description: '분석에 실패했을 때 보여줄 문구. 비우면 실패 안내를 숨긴다.' },
    destination: { control: 'object', description: '고른 목적지' },
    maxMinutes: {
      control: { type: 'range', min: 10, max: 60, step: 10 },
      description: '최대 통근 시간(분)',
    },
    isMockData: { description: '서버 대신 예시 데이터로 보여주는 중인지' },
    reset: { description: '다시 시도(출퇴근 장소부터 다시 입력)와 분석 취소' },
  },
  args: {
    isAnalyzing: true,
    error: null,
    destination: {
      name: '서울특별시청',
      address: '서울특별시 중구 세종대로 110',
      latitude: 37.5663,
      longitude: 126.9779,
    },
    maxMinutes: 40,
    isMockData: false,
    reset: fn(),
    retry: fn(),
    editSearch: fn(),
  },
} satisfies Meta<StoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Analyzing: Story = {};

export const WithMockData: Story = {
  args: {
    isMockData: true,
  },
};

export const WithError: Story = {
  args: {
    isAnalyzing: false,
    error: '대중교통 정보를 준비하고 있습니다. 잠시 후 다시 시도해 주세요.',
  },
};
