import type { Meta, StoryObj } from '@storybook/react-webpack5';

import AddressSearchResults from './AddressSearchResults';

const meta = {
  title: '지도/AddressSearchResults',
  component: AddressSearchResults,
  args: { results: [], status: 'idle', onSelect: () => undefined },
  argTypes: { onSelect: { action: 'select address' } },
} satisfies Meta<typeof AddressSearchResults>;
export default meta;
type Story = StoryObj<typeof meta>;
export const BeforeSearch: Story = {};
export const Loading: Story = { args: { status: 'loading' } };
export const Error: Story = { args: { status: 'error' } };
export const Empty: Story = { args: { status: 'success' } };
export const Results: Story = {
  args: {
    status: 'success',
    results: [
      {
        address: '서울특별시 중구 세종대로 110',
        roadAddress: '서울특별시 중구 세종대로 110',
        jibunAddress: '서울특별시 중구 태평로1가 31',
        latitude: 37.5665,
        longitude: 126.978,
      },
    ],
  },
};
