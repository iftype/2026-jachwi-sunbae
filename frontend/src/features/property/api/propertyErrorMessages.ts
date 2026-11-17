import { ApiError, getSafeApiErrorMessage, isApiErrorCode } from '@/features/auth/api/apiClient';
import type { QueryErrorView } from '@/shared/ui/query-state/QueryState';

const messages: Record<string, string> = {
  INVALID_REQUEST: '입력한 내용을 다시 확인해 주세요.',
  INVALID_PAGE_REQUEST: '목록을 불러오지 못했어요. 화면을 다시 열어 주세요.',
  PROPERTY_NOT_FOUND: '매물을 찾을 수 없어요. 목록에서 다시 확인해 주세요.',
  PROPERTY_MEMO_INVALID: '메모 입력 길이와 필수 항목을 다시 확인해 주세요.',
  AMBIGUOUS_MEMO_CONTENT: '메모를 저장하지 못했어요. 화면을 다시 연 뒤 다시 시도해 주세요.',
  PHOTO_NOT_FOUND: '사진을 찾을 수 없어요. 사진 목록을 새로 확인해 주세요.',
  PHOTO_FORMAT_UNSUPPORTED: 'JPEG, PNG, WebP 사진만 올릴 수 있어요.',
  PHOTO_FILE_SIZE_INVALID: '사진 한 장은 10MB 이하만 올릴 수 있어요.',
  PHOTO_FILE_TOO_LARGE: '사진 한 장은 10MB 이하만 올릴 수 있어요.',
  PHOTO_COUNT_EXCEEDED: '사진은 매물마다 30장까지 올릴 수 있어요.',
  PHOTO_UPLOAD_FAILED: '사진을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.',
  PHOTO_READ_FAILED: '사진을 불러오지 못했어요. 다시 시도해 주세요.',
  PHOTO_DELETE_FAILED: '사진을 삭제하지 못했어요. 잠시 후 다시 시도해 주세요.',
  PROPERTY_AI_IMAGE_INVALID: 'PNG·JPG 이미지를 1~10장, 장당 3MB 이하로 골라 주세요.',
  PROPERTY_AI_PROVIDER_UNAVAILABLE: '이미지 분석을 잠시 이용할 수 없어요. 잠시 후 다시 시도해 주세요.',
  PROPERTY_AI_RESPONSE_INVALID: '이미지에서 매물 정보를 읽지 못했어요. 다른 캡처로 다시 시도해 주세요.',
};

export const getPropertyErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError && error.code !== null && messages[error.code] !== undefined) {
    return messages[error.code];
  }

  return getSafeApiErrorMessage(error);
};

/** 매물을 조회하지 못했을 때의 안내. 없는 매물이면 다시 시도를 막는다. */
export const describePropertyLoadError =
  (failedTitle: string) =>
  (error: unknown): QueryErrorView =>
    isApiErrorCode(error, 'PROPERTY_NOT_FOUND')
      ? { title: '매물을 찾을 수 없어요.', description: getPropertyErrorMessage(error), canRetry: false }
      : { title: failedTitle, description: getPropertyErrorMessage(error), canRetry: true };
