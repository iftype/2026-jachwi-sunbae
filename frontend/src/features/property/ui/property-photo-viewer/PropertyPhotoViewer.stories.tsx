import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { fn } from 'storybook/test';

import { propertyQueryKeys } from '../../api/propertyQueryKeys';
import type { PropertyPhoto, PropertyPhotoList } from '../../model/Property';
import PropertyPhotoViewer from './PropertyPhotoViewer';

const photoBlob = (color: string) =>
  new Blob(
    [
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">' +
        `<rect width="400" height="300" fill="#f1ede2"/><rect x="50" y="40" width="300" height="160" fill="${color}"/></svg>`,
    ],
    { type: 'image/svg+xml' },
  );

const photos: PropertyPhoto[] = [1, 2, 3].map((photoId) => ({
  photoId,
  contentUrl: `/api/properties/10/photos/${photoId}/content`,
  thumbnailUrl: `/api/properties/10/photos/${photoId}/thumbnail`,
  contentType: 'image/jpeg',
  sizeBytes: 700_000,
  createdAt: '2026-10-20T14:00:00+09:00',
  representative: photoId === 1,
}));

const photoList: PropertyPhotoList = { photos, totalCount: photos.length };

const meta = {
  title: '기능/매물/PropertyPhotoViewer',
  component: PropertyPhotoViewer,
  args: {
    propertyId: 10,
    propertyName: '햇살 좋은 원룸',
    initialIndex: 0,
    onClose: fn(),
  },
  argTypes: {
    propertyId: { control: false, description: '매물 ID. 표본 사진 캐시가 10번 매물 기준이라 고정한다.' },
    propertyName: { description: '위에 보이는 매물 이름. 사진 대체 텍스트에도 쓴다.' },
    initialIndex: {
      control: { type: 'range', min: 0, max: 2, step: 1 },
      description: '처음 보여줄 사진 순번(0부터). 표본 사진은 3장이다. 처음 그릴 때만 읽는다.',
    },
    onClose: { description: '닫기를 눌렀을 때' },
  },
  parameters: {
    layout: 'fullscreen',
    queryData: [
      [propertyQueryKeys.photos(10), photoList],
      [propertyQueryKeys.photoContent(10, 1), photoBlob('#bcd4f0')],
      [propertyQueryKeys.photoContent(10, 2), photoBlob('#c9b79c')],
      [propertyQueryKeys.photoContent(10, 3), photoBlob('#d8e6c4')],
    ],
  },
} satisfies Meta<typeof PropertyPhotoViewer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LastPhoto: Story = {
  args: {
    initialIndex: 2,
  },
};

export const Empty: Story = {
  parameters: {
    queryData: [[propertyQueryKeys.photos(10), { photos: [], totalCount: 0 }]],
  },
};
