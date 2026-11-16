import { skipToken, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { usePublicConfig } from '@/shared/config/PublicConfigContext';
import type { PublicConfig } from '@/shared/config/publicConfigTypes';

import { fetchPropertyPhotos } from './photoApi';
import {
  orPreview,
  previewPropertyChecklistDetail,
  previewPropertyChecklistOverview,
  previewPropertyDetail,
  previewPropertyMemo,
  previewPropertyPhotos,
} from './previewPropertyApi';
import {
  fetchProperties,
  fetchPropertyChecklistDetail,
  fetchPropertyChecklistOverview,
  fetchPropertyCommuteTimes,
  fetchPropertyDetail,
  fetchPropertyMemo,
} from './propertyApi';
import { propertyQueryKeys } from './propertyQueryKeys';

/** `enabled`를 끄면 부르지 않는다. 동네 찾기는 `My`를 켰을 때만 기록한 매물을 받는다. */
export const usePropertyList = (enabled = true) => {
  const config = usePublicConfig();
  return useInfiniteQuery({
    queryKey: propertyQueryKeys.list(''),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => fetchProperties(config, { query: '', page: pageParam, size: 20 }, signal),
    getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.page + 1 : undefined),
    enabled,
  });
};

/** 목적지가 없으면 부르지 않는다. 매물 목록이 바뀌면(추가·수정·삭제) 목록과 함께 다시 받는다. */
export const usePropertyCommuteTimes = (destination: { latitude: number; longitude: number } | null) => {
  const config = usePublicConfig();
  return useQuery({
    queryKey: propertyQueryKeys.commuteTimes(destination?.latitude ?? 0, destination?.longitude ?? 0),
    queryFn: destination === null ? skipToken : ({ signal }) => fetchPropertyCommuteTimes(config, destination, signal),
    staleTime: 5 * 60 * 1000,
  });
};

export const getPropertyDetailQueryOptions = (config: PublicConfig, propertyId: number) => ({
  queryKey: propertyQueryKeys.detail(propertyId),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    orPreview(propertyId, previewPropertyDetail, () => fetchPropertyDetail(config, propertyId, signal)),
});

export const usePropertyDetail = (propertyId: number) => {
  const config = usePublicConfig();
  return useQuery(getPropertyDetailQueryOptions(config, propertyId));
};

export const usePropertyMemo = (propertyId: number) => {
  const config = usePublicConfig();
  return useQuery({
    queryKey: propertyQueryKeys.memo(propertyId),
    queryFn: ({ signal }) =>
      orPreview(propertyId, previewPropertyMemo, () => fetchPropertyMemo(config, propertyId, signal)),
  });
};

export const usePropertyChecklistOverview = (propertyId: number) => {
  const config = usePublicConfig();
  return useQuery({
    queryKey: propertyQueryKeys.checklists(propertyId),
    queryFn: ({ signal }) =>
      orPreview(propertyId, previewPropertyChecklistOverview, () =>
        fetchPropertyChecklistOverview(config, propertyId, signal),
      ),
  });
};

export const usePropertyChecklistDetail = (propertyId: number, propertyChecklistId: number) => {
  const config = usePublicConfig();
  return useQuery({
    queryKey: propertyQueryKeys.checklist(propertyId, propertyChecklistId),
    queryFn: ({ signal }) =>
      orPreview(propertyId, previewPropertyChecklistDetail, () =>
        fetchPropertyChecklistDetail(config, propertyId, propertyChecklistId, signal),
      ),
  });
};

export const usePropertyPhotos = (propertyId: number) => {
  const config = usePublicConfig();
  return useQuery({
    queryKey: propertyQueryKeys.photos(propertyId),
    queryFn: ({ signal }) =>
      orPreview(propertyId, previewPropertyPhotos, () => fetchPropertyPhotos(config, propertyId, signal)),
  });
};
