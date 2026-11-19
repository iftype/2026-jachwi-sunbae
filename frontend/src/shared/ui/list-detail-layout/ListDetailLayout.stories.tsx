import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { fn } from 'storybook/test';

import ListDetailLayout from './ListDetailLayout';

const panelStyle = { padding: '1.5rem' };

/** 가운데 상세 칸. 값은 이름으로 두고 그릴 때 요소로 바꾼다. */
const details = {
  없음: undefined,
  '신림동 대중교통': (
    <div style={panelStyle}>
      <h2>신림동 대중교통</h2>
      <p>신림역까지 걸어서 7분, 강남역까지 지하철로 25분 걸려요.</p>
    </div>
  ),
};

const meta = {
  title: '공용/ListDetailLayout',
  component: ListDetailLayout,
  argTypes: {
    list: { control: false },
    detail: { control: 'inline-radio', options: Object.keys(details), mapping: details },
    children: { control: false },
    onCloseDetail: { control: false },
  },
  args: {
    list: (
      <div style={panelStyle}>
        <h2>동네 목록</h2>
        <ol>
          <li>신림동</li>
          <li>봉천동</li>
          <li>서교동</li>
        </ol>
      </div>
    ),
    detail: '없음',
    closeLabel: '상세 닫기',
    onCloseDetail: fn(),
    children: (
      <div style={{ ...panelStyle, height: '100%', background: '#e8eef5' }}>
        <p>지도 영역</p>
      </div>
    ),
  },
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div style={{ height: '40rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ListDetailLayout>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ListOnly: Story = {};

export const WithDetail: Story = {
  args: {
    detail: '신림동 대중교통',
    closeLabel: '신림동 상세 닫기',
  },
};

/** 내 기록 상세, 동네 찾기 매물 패널처럼 닫지 않고 접는 상세. 접은 상태는 이 기기에 기억한다. */
export const Collapsible: Story = {
  args: {
    detail: '신림역 원룸 상세',
    collapsible: true,
  },
};
