import { authenticationQueryKey } from '@/shared/api/queryClient';

export const propertyQueryKeys = {
  all: [...authenticationQueryKey, 'properties'] as const,
  lists: () => [...propertyQueryKeys.all, 'list'] as const,
  list: (query: string) => [...propertyQueryKeys.lists(), { query: query.trim(), size: 20 }] as const,
  // 매물을 추가·수정·삭제하면 목록과 함께 다시 받도록 목록 키 아래에 둔다.
  commuteTimes: (latitude: number, longitude: number) =>
    [...propertyQueryKeys.lists(), 'commute-times', latitude, longitude] as const,
  details: () => [...propertyQueryKeys.all, 'detail'] as const,
  detail: (propertyId: number) => [...propertyQueryKeys.details(), propertyId] as const,
  memo: (propertyId: number) => [...propertyQueryKeys.detail(propertyId), 'memo'] as const,
  checklists: (propertyId: number) => [...propertyQueryKeys.detail(propertyId), 'checklists'] as const,
  checklist: (propertyId: number, propertyChecklistId: number) =>
    [...propertyQueryKeys.checklists(propertyId), propertyChecklistId] as const,
  photos: (propertyId: number) => [...propertyQueryKeys.detail(propertyId), 'photos'] as const,
  photoContents: (propertyId: number) => [...propertyQueryKeys.photos(propertyId), 'content'] as const,
  photoContent: (propertyId: number, photoId: number, kind: 'original' | 'thumbnail' = 'original') =>
    [...propertyQueryKeys.photoContents(propertyId), photoId, kind] as const,
};
