import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { useEffect } from 'react';

import { skipPreviewSave } from '@/features/property/api/previewPropertyApi';
import { SAMPLE_PROPERTIES } from '@/features/property/model/sampleProperties';

import PreviewNotSavedToast from './PreviewNotSavedToast';

const previewId = SAMPLE_PROPERTIES[0]?.propertyId ?? -1;

/** 미리보기 매물을 고치려 할 때처럼 저장 막기를 한 번 불러 토스트를 띄운다. */
const OpenOnMount = () => {
  useEffect(() => {
    void skipPreviewSave(
      previewId,
      () => null,
      () => Promise.resolve(null),
    );
  }, []);
  return null;
};

/** 미리보기 매물을 고치면 저장되지 않는다고 화면 아래 가운데에 잠깐 알린다. */
const meta = {
  title: '페이지/매물 상세/PreviewNotSavedToast',
  component: PreviewNotSavedToast,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ minHeight: '240px' }}>
        <Story />
        <OpenOnMount />
      </div>
    ),
  ],
} satisfies Meta<typeof PreviewNotSavedToast>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
