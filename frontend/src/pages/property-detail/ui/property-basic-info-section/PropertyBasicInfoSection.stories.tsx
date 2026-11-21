import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { fn } from 'storybook/test';

import type { PropertyDetail } from '@/features/property/model/Property';

import PropertyBasicInfoSection from './PropertyBasicInfoSection';

const property: PropertyDetail = {
  propertyId: 10,
  name: '햇살 좋은 원룸',
  depositAmount: 10_000_000,
  monthlyRentAmount: 550_000,
  discoverySource: { type: 'TEXT', value: '신림역 행복공인중개사' },
  location: { address: '서울 관악구 신림로 123', latitude: 37.4842, longitude: 126.9297 },
  availableMoveInDate: '2026-11-15',
  maintenanceFeeAmount: 70_000,
  visitScheduledAt: '2026-10-30T18:30:00',
  roomOptions: ['AIR_CONDITIONER', 'REFRIGERATOR', 'WASHING_MACHINE', 'BED'],
  utilityOptions: ['WATER', 'INTERNET'],
  photoPreview: { totalCount: 0, photos: [] },
  createdAt: '2026-10-20T14:30:00',
  updatedAt: '2026-10-27T10:00:00',
};

const meta = {
  title: '페이지/매물 상세/PropertyBasicInfoSection',
  component: PropertyBasicInfoSection,
  argTypes: {
    property: { control: 'object', description: '표본 매물 상세 데이터. JSON으로 값을 바꿔 볼 수 있다.' },
  },
  args: {
    property,
    onEdit: fn(),
    onSaved: fn(),
    onCancel: fn(),
    onEditLocation: fn(),
    onSaveLocation: fn(async () => undefined),
    editingField: null,
    savedField: null,
  },
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof PropertyBasicInfoSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutAddress: Story = {
  args: {
    property: {
      ...property,
      name: '신림역 5분 거리 채광 좋은 투룸 오피스텔',
      location: { address: null, latitude: null, longitude: null },
    },
  },
};

/** 주소를 누르면 그 줄 안에서 검색 칸이 열린다. 바깥을 누르면 닫고 직전 주소가 그대로 보인다. */
export const EditingAddress: Story = {
  args: { editingField: 'location' },
};
