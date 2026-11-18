import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { fn } from 'storybook/test';

import { propertyQueryKeys } from '@/features/property/api/propertyQueryKeys';
import type { PropertyPhotoPreview } from '@/features/property/model/Property';

import PropertyHeroPhoto from './PropertyHeroPhoto';

const photoBlob = (label: string, color: string) =>
  new Blob(
    [
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="${color}"/><text x="320" y="250" font-size="40" text-anchor="middle" fill="#ffffff">${label}</text></svg>`,
    ],
    { type: 'image/svg+xml' },
  );

const photos: PropertyPhotoPreview[] = [
  {
    photoId: 101,
    contentUrl: '/api/properties/10/photos/101/content',
    thumbnailUrl: '/api/properties/10/photos/101/thumbnail',
    createdAt: '2026-10-20T14:31:00',
  },
];

const meta = {
  title: '페이지/매물 상세/PropertyHeroPhoto',
  component: PropertyHeroPhoto,
  argTypes: {
    propertyId: { control: false, description: '사진을 불러올 매물 ID. 표본 사진 캐시는 10번에만 있다.' },
    propertyName: { description: '사진 버튼 접근성 이름에 쓰는 매물 이름.' },
    photos: { control: 'object', description: '대표 사진으로 쓸 사진 목록. 첫 장을 보여 준다.' },
    backTo: { description: '뒤로 가기 버튼이 이동할 주소.' },
    backState: { control: false },
    showBackButton: { description: '왼쪽 위 뒤로 가기 버튼을 보일지.' },
    onOpen: { description: '사진을 누르면 부른다(사진 뷰어 열기).' },
  },
  args: {
    propertyId: 10,
    propertyName: '햇살 좋은 원룸',
    photos,
    backTo: '/properties',
    showBackButton: true,
    onOpen: fn(),
  },
  parameters: {
    layout: 'fullscreen',
    queryData: [[propertyQueryKeys.photoContent(10, 101), photoBlob('거실', '#7a9cc6')]],
  },
  decorators: [
    (Story) => (
      <div style={{ width: '24rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PropertyHeroPhoto>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithPhoto: Story = {};

export const Empty: Story = {
  args: {
    photos: [],
    backTo: '/',
  },
};

export const WithoutBackButton: Story = {
  args: {
    showBackButton: false,
  },
};
