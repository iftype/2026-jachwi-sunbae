import { useState } from 'react';

import { getPropertyErrorMessage } from '../api/propertyErrorMessages';
import { useImportPropertyFromImages } from '../api/usePropertyMutations';

export const MAX_AI_IMPORT_IMAGES = 10;
export const MAX_AI_IMPORT_IMAGE_BYTES = 3 * 1024 * 1024;
export const acceptedAiImportTypes = ['image/png', 'image/jpeg'] as const;

export type PropertyAiImportFeedback = {
  tone: 'success' | 'error';
  message: string;
};

/** 서버와 같은 기준으로 먼저 걸러, 보낼 수 없는 이미지로 분석을 기다리지 않게 한다. */
const validateFiles = (files: File[]): string | null => {
  if (files.length > MAX_AI_IMPORT_IMAGES) return `이미지는 ${MAX_AI_IMPORT_IMAGES}장까지 고를 수 있어요.`;
  if (files.some((file) => !acceptedAiImportTypes.some((type) => type === file.type)))
    return 'PNG 또는 JPG 이미지를 골라 주세요.';
  if (files.some((file) => file.size === 0)) return '빈 파일이 있어요. 다른 이미지를 골라 주세요.';
  if (files.some((file) => file.size > MAX_AI_IMPORT_IMAGE_BYTES)) return '이미지 한 장은 3MB 이하만 올릴 수 있어요.';
  return null;
};

/** 매물 캡처 이미지를 골라 서버에서 분석·저장하고, 결과를 한 줄로 알린다. */
export const usePropertyAiImport = (propertyId: number) => {
  const importMutation = useImportPropertyFromImages(propertyId);
  const [feedback, setFeedback] = useState<PropertyAiImportFeedback | null>(null);

  const importFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const invalidMessage = validateFiles(files);
    if (invalidMessage !== null) {
      setFeedback({ tone: 'error', message: invalidMessage });
      return;
    }
    setFeedback(null);
    try {
      await importMutation.mutateAsync(files);
      setFeedback({ tone: 'success', message: '이미지에서 읽은 정보를 저장했어요.' });
    } catch (error) {
      setFeedback({ tone: 'error', message: getPropertyErrorMessage(error) });
    }
  };

  return { importFiles, isImporting: importMutation.isPending, feedback };
};
