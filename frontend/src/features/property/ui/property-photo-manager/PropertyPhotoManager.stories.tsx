import type { Meta, StoryObj } from '@storybook/react-webpack5';

import { propertyQueryKeys } from '../../api/propertyQueryKeys';
import type { PropertyPhoto, PropertyPhotoList } from '../../model/Property';
import PropertyPhotoManager from './PropertyPhotoManager';

const colors = ['#bcd4f0', '#c9b79c', '#d8e6c4', '#f0d0bc', '#d4c8ec', '#bfe3df', '#efe1a8', '#e6c4cf'];

const photoBlob = (color: string) =>
  new Blob(
    [
      '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">' +
        `<rect width="300" height="300" fill="#f1ede2"/><rect x="40" y="40" width="220" height="150" fill="${color}"/></svg>`,
    ],
    { type: 'image/svg+xml' },
  );

const makePhotos = (count: number): PropertyPhoto[] =>
  Array.from({ length: count }, (_, index) => ({
    photoId: index + 1,
    contentUrl: `/api/properties/10/photos/${index + 1}/content`,
    thumbnailUrl: `/api/properties/10/photos/${index + 1}/thumbnail`,
    contentType: 'image/jpeg',
    sizeBytes: 600_000 + index * 10_000,
    createdAt: `2026-10-2${index % 10}T14:00:00+09:00`,
    representative: index === 0,
  }));

const photoQueryData = (photos: PropertyPhoto[]) => {
  const list: PropertyPhotoList = { photos, totalCount: photos.length };
  return [
    [propertyQueryKeys.photos(10), list],
    ...photos.map((photo, index) => [
      propertyQueryKeys.photoContent(10, photo.photoId, 'thumbnail'),
      photoBlob(colors[index % colors.length]),
    ]),
  ];
};

const meta = {
  title: '기능/매물/PropertyPhotoManager',
  component: PropertyPhotoManager,
  args: {
    propertyId: 10,
    showHeading: true,
  },
  argTypes: {
    propertyId: { control: false, description: '매물 ID. 표본 사진 캐시가 10번 매물 기준이라 고정한다.' },
    showHeading: { description: '위에 "사진 관리" 제목을 보인다. 끄면 화면 읽기 프로그램에만 읽힌다.' },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '24rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PropertyPhotoManager>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: {
    queryData: photoQueryData(makePhotos(3)),
  },
};

export const Empty: Story = {
  parameters: {
    queryData: photoQueryData([]),
  },
};

export const ManyPhotos: Story = {
  parameters: {
    queryData: photoQueryData(makePhotos(8)),
  },
};

/** 사진 목록을 캐시에 넣지 않아 요청이 실패한 화면이 그려진다. */
export const RequestFailed: Story = {};
