import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { fn } from 'storybook/test';

import { propertyQueryKeys } from '@/features/property/api/propertyQueryKeys';
import type { PropertyPhotoPreview } from '@/features/property/model/Property';

import PropertyPhotoSection from './PropertyPhotoSection';

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
  {
    photoId: 102,
    contentUrl: '/api/properties/10/photos/102/content',
    thumbnailUrl: '/api/properties/10/photos/102/thumbnail',
    createdAt: '2026-10-20T14:32:00',
  },
  {
    photoId: 103,
    contentUrl: '/api/properties/10/photos/103/content',
    thumbnailUrl: '/api/properties/10/photos/103/thumbnail',
    createdAt: '2026-10-20T14:33:00',
  },
];

const photoQueryData = [
  [propertyQueryKeys.photoContent(10, 101, 'thumbnail'), photoBlob('거실', '#7a9cc6')],
  [propertyQueryKeys.photoContent(10, 102, 'thumbnail'), photoBlob('주방', '#c69a7a')],
  [propertyQueryKeys.photoContent(10, 103, 'thumbnail'), photoBlob('욕실', '#7ac6a4')],
];

const meta = {
  title: '페이지/매물 상세/PropertyPhotoSection',
  component: PropertyPhotoSection,
  argTypes: {
    propertyId: { control: false, description: '사진을 불러올 매물 ID. 표본 사진 캐시는 10번에만 있다.' },
    propertyName: { description: '사진 버튼 접근성 이름에 쓰는 매물 이름.' },
    photoPreview: {
      control: 'object',
      description: '미리 보기 사진과 전체 장수. totalCount가 3보다 크면 세 번째 칸에 +N 표시가 붙는다.',
    },
    onSelect: { description: '사진을 누르면 순번과 누른 버튼을 넘겨 부른다.' },
  },
  args: {
    propertyId: 10,
    propertyName: '햇살 좋은 원룸',
    photoPreview: { totalCount: 3, photos },
    onSelect: fn(),
  },
  parameters: {
    layout: 'fullscreen',
    queryData: photoQueryData,
  },
} satisfies Meta<typeof PropertyPhotoSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const MorePhotos: Story = {
  args: {
    photoPreview: { totalCount: 8, photos },
  },
};

export const Empty: Story = {
  args: {
    photoPreview: { totalCount: 0, photos: [] },
  },
};
