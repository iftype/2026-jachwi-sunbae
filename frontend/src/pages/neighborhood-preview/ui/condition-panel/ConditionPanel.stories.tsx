import type { Meta, StoryObj } from '@storybook/react-webpack5';
import type { ComponentProps, ComponentType } from 'react';
import { fn } from 'storybook/test';

import ConditionPanel from './ConditionPanel';

type Props = ComponentProps<typeof ConditionPanel>;
/** `preview`에 든 값을 하나씩 컨트롤로 바꿔 보도록 펼쳐 둔다. 화면에는 다시 `preview`로 묶어 넘긴다. */
type StoryArgs = Props['preview'] & Omit<Props, 'preview'>;

const meta = {
  title: '페이지/동네 찾기/공통/ConditionPanel',
  // 컨트롤은 preview를 펼친 값으로 받아 render에서 다시 묶는다. props 모양이 달라 타입만 맞춰 주고, 문서는 실제 컴포넌트에서 읽는다.
  component: ConditionPanel as unknown as ComponentType<StoryArgs>,
  parameters: {
    layout: 'fullscreen',
    controls: { exclude: ['preview', 'className', 'ref'] },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '22rem', height: '44rem', display: 'flex' }}>
        <Story />
      </div>
    ),
  ],
  render: ({ disabled, onSubmit, ...preview }) => (
    <ConditionPanel preview={preview} disabled={disabled} onSubmit={onSubmit} />
  ),
  argTypes: {
    hasChosenMapPoint: { description: '지도에서 목적지를 골랐는지. 고르지 않으면 주소 검색 결과를 보여준다.' },
    mapCandidate: { control: 'object', description: '지도에서 고른 목적지 후보' },
    isSearching: { description: '주소를 검색하는 중인지' },
    searchError: { control: 'text', description: '주소 검색 오류 문구' },
    addressResults: { control: 'object', description: '주소 검색 결과 목록' },
    maxMinutes: {
      control: { type: 'range', min: 10, max: 60, step: 10 },
      description: '최대 통근 시간(분)',
    },
    maxTransfers: {
      control: { type: 'range', min: 0, max: 2, step: 1 },
      description: '최대 환승 횟수',
    },
    isValidCommuteTime: { description: '통근 시간 조건이 올바른지. 아니면 분석 버튼을 막는다.' },
    disabled: { description: '조건을 바꾸지 못하게 막을지' },
    selectAddress: { description: '검색 결과에서 주소 고르기' },
    editLocation: { description: '고른 출퇴근 장소를 다시 고르러 가기' },
    changeMaxMinutes: { description: '통근 시간 바꾸기' },
    changeMaxTransfers: { description: '환승 횟수 바꾸기' },
    onSubmit: { description: '이 조건으로 분석 시작' },
  },
  args: {
    hasChosenMapPoint: true,
    mapCandidate: {
      name: '서울특별시청',
      address: '서울특별시 중구 세종대로 110',
      latitude: 37.5663,
      longitude: 126.9779,
    },
    isSearching: false,
    searchError: null,
    addressResults: [],
    selectAddress: fn(),
    editLocation: fn(),
    isMapSelectionEnabled: false,
    openMapSelection: fn(),
    cancelMapSelection: fn(),
    maxMinutes: 40,
    changeMaxMinutes: fn(),
    maxTransfers: 1,
    changeMaxTransfers: fn(),
    isValidCommuteTime: true,
    maxRent: 0,
    changeMaxRent: fn(),
    disabled: false,
    onSubmit: fn(),
  },
} satisfies Meta<StoryArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoPlaceChosen: Story = {
  args: {
    hasChosenMapPoint: false,
  },
};

export const WithAddressResults: Story = {
  args: {
    hasChosenMapPoint: false,
    addressResults: [
      {
        address: '서울특별시 중구 세종대로 110',
        roadAddress: '서울특별시 중구 세종대로 110',
        jibunAddress: '서울특별시 중구 태평로1가 31',
        latitude: 37.5663,
        longitude: 126.9779,
      },
      {
        address: '서울특별시 중구 세종대로 135',
        roadAddress: '서울특별시 중구 세종대로 135',
        jibunAddress: '서울특별시 중구 태평로1가 25',
        latitude: 37.5683,
        longitude: 126.9776,
      },
    ],
  },
};

export const WithSearchError: Story = {
  args: {
    hasChosenMapPoint: false,
    searchError: '검색 결과가 없어요. 주소를 더 자세히 입력해주세요.',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
