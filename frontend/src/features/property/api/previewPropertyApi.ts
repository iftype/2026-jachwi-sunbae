import type {
  PropertyChecklistDetail,
  PropertyChecklistItem,
  PropertyChecklistOverview,
  PropertyDetail,
  PropertyMemoDocument,
  PropertyPhoto,
  PropertyPhotoList,
  RoomOption,
  UtilityOption,
} from '../model/Property';
import { isPreviewProperty, SAMPLE_PROPERTIES } from '../model/sampleProperties';
import sampleProperties from '../model/sampleProperties.json';

/**
 * 미리보기 매물은 서버에 없으므로 상세, 메모, 체크리스트 개요를 JSON에서 만들어 돌려준다.
 * 쿼리 함수만 이 파일을 거치고, 화면 컴포넌트는 실제 매물과 똑같이 그린다.
 */
const previewSource = (propertyId: number) => {
  const index = SAMPLE_PROPERTIES.findIndex((property) => property.propertyId === propertyId);
  if (index < 0) throw new Error('미리보기 매물을 찾지 못했습니다.');
  return { summary: SAMPLE_PROPERTIES[index], extra: sampleProperties.properties[index] };
};

const PREVIEW_DATE = '2026-01-01T00:00:00';

export const previewPropertyDetail = (propertyId: number): PropertyDetail => {
  const { summary, extra } = previewSource(propertyId);
  return {
    propertyId: summary.propertyId,
    name: summary.name,
    depositAmount: summary.depositAmount,
    monthlyRentAmount: summary.monthlyRentAmount,
    discoverySource: summary.discoverySource,
    location: summary.location,
    availableMoveInDate: extra.availableMoveInDate,
    maintenanceFeeAmount: extra.maintenanceFeeAmount,
    visitScheduledAt: extra.visitScheduledAt,
    roomOptions: extra.roomOptions as RoomOption[],
    utilityOptions: extra.utilityOptions as UtilityOption[],
    photoPreview: { totalCount: summary.photoCount, photos: previewPhotos(propertyId) },
    createdAt: PREVIEW_DATE,
    updatedAt: PREVIEW_DATE,
  };
};

export const previewPropertyMemo = (propertyId: number): PropertyMemoDocument => ({
  propertyId,
  freeMemo: previewSource(propertyId).extra.memo,
});

export const previewPropertyChecklistOverview = (propertyId: number): PropertyChecklistOverview => {
  const { summary } = previewSource(propertyId);
  return { propertyId, overallProgress: summary.progress, stages: summary.stages };
};

const previewPhotos = (propertyId: number): PropertyPhoto[] => {
  const photo = previewSource(propertyId).summary.representativePhoto;
  return photo === null ? [] : [{ ...photo, sizeBytes: 0, createdAt: PREVIEW_DATE, representative: true }];
};

export const previewPropertyPhotos = (propertyId: number): PropertyPhotoList => {
  const photos = previewPhotos(propertyId);
  return { photos, totalCount: photos.length };
};

/** 사진 내용. 미리보기 사진은 앱에 들어 있는 이미지라 로그인 요청 없이 그대로 받는다. */
export const fetchPhotoContentOrPreview = (
  propertyId: number,
  contentUrl: string,
  fetchRemote: () => Promise<Blob>,
): Promise<Blob> =>
  isPreviewProperty(propertyId) ? fetch(contentUrl).then((response) => response.blob()) : fetchRemote();

export const previewPropertyChecklistDetail = (propertyId: number): PropertyChecklistDetail => {
  const { summary, extra } = previewSource(propertyId);
  const stage = summary.stages[0];
  return {
    propertyChecklistId: stage?.propertyChecklistId ?? -1,
    propertyId,
    sourceChecklistId: null,
    checklistName: stage?.checklistName ?? '현장 체크리스트',
    stage: 'ON_SITE',
    items: extra.checklistItems as PropertyChecklistItem[],
  };
};

/** 미리보기 매물이면 JSON 값을, 아니면 서버 요청을 쓴다. */
// 이 저장소의 babel 설정은 .ts도 JSX로 읽어 화살표 함수 제네릭 `<T>`를 태그로 오해한다. 그래서 function으로 쓴다.
export function orPreview<T>(propertyId: number, preview: (id: number) => T, fetch: () => Promise<T>): Promise<T> {
  return isPreviewProperty(propertyId) ? Promise.resolve(preview(propertyId)) : fetch();
}

const notSavedListeners = new Set<() => void>();

/** 미리보기 매물을 고치려 할 때 알림을 받는다. 화면은 이걸로 "저장되지 않아요" 토스트를 띄운다. */
export const subscribePreviewNotSaved = (listener: () => void) => {
  notSavedListeners.add(listener);
  return () => {
    notSavedListeners.delete(listener);
  };
};

const notifyPreviewNotSaved = () => notSavedListeners.forEach((listener) => listener());

/**
 * 미리보기 매물은 서버에 저장하지 않는다. 알림만 보내고 `unchanged` 값(고치기 전 값)을 돌려줘 편집 칸을 닫는다.
 * 실제 매물이면 `save`를 그대로 부른다.
 */
export function skipPreviewSave<T>(propertyId: number, unchanged: () => T, save: () => Promise<T>): Promise<T> {
  if (!isPreviewProperty(propertyId)) return save();
  notifyPreviewNotSaved();
  return Promise.resolve(unchanged());
}

/** 돌려줄 값이 없는 요청(사진 올리기, 지우기 등)은 알림을 보내고 실패로 끝낸다. */
export function blockPreviewSave<T>(propertyId: number, save: () => Promise<T>): Promise<T> {
  if (!isPreviewProperty(propertyId)) return save();
  notifyPreviewNotSaved();
  return Promise.reject(new Error('미리보기 매물은 저장하지 않습니다.'));
}
