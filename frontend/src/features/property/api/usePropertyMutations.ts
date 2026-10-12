import type { InfiniteData } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryClient } from '@/shared/api/queryClient';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';

import type { PropertyCreationEntrypoint } from '../lib/propertyAnalytics';
import { trackPropertyEvent } from '../lib/propertyAnalytics';
import type { PropertyBasicInfo, PropertyDetail, PropertyPage } from '../model/Property';
import type {
  PropertyInputDto,
  SavePropertyMemoDocumentRequestDto,
  UpdatePropertyRequestDto,
} from './dtos/PropertyDto';
import { removePropertyPhoto, setRepresentativePropertyPhoto, uploadPropertyPhoto } from './photoApi';
import {
  createProperty,
  recordPropertyComparisonView,
  removeProperty,
  savePropertyMemoDocument,
  updateProperty,
} from './propertyApi';
import { propertyQueryKeys } from './propertyQueryKeys';

export const useCreateProperty = (entrypoint: PropertyCreationEntrypoint = 'form') => {
  const config = usePublicConfig();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: PropertyInputDto) => createProperty(config, request),
    onMutate: () => {
      const total = client.getQueryData<InfiniteData<PropertyPage>>(propertyQueryKeys.list(''))?.pages[0]
        ?.totalElements;
      trackPropertyEvent('property_creation_submitted', { entrypoint });
      return { firstProperty: total === undefined ? undefined : total === 0 };
    },
    onSuccess: async (created, _request, context) => {
      trackPropertyEvent('property_created', {
        entrypoint,
        property_id: created.propertyId,
        ...(context?.firstProperty === undefined ? {} : { first_property: context.firstProperty }),
      });
      await client.invalidateQueries({ queryKey: propertyQueryKeys.lists() });
    },
    onError: () => trackPropertyEvent('property_creation_failed', { entrypoint, error_kind: 'request' }),
  });
};

export const useRecordPropertyComparisonView = () => {
  const config = usePublicConfig();
  return useMutation({
    mutationFn: () => recordPropertyComparisonView(config),
  });
};

export type PropertyChanges = Partial<UpdatePropertyRequestDto>;

/** 매물 수정 API는 전체를 덮어쓰므로, 현재 상세에 바뀐 값만 얹어 요청을 만든다. */
const toUpdatePropertyRequest = (current: PropertyDetail, changes: PropertyChanges): UpdatePropertyRequestDto => ({
  name: current.name,
  depositAmount: current.depositAmount,
  monthlyRentAmount: current.monthlyRentAmount,
  discoverySource: current.discoverySource.value || null,
  address: current.location.address,
  latitude: current.location.latitude,
  longitude: current.location.longitude,
  availableMoveInDate: current.availableMoveInDate,
  maintenanceFeeAmount: current.maintenanceFeeAmount,
  visitScheduledAt: current.visitScheduledAt,
  roomOptions: current.roomOptions,
  utilityOptions: current.utilityOptions,
  ...changes,
});

export const useUpdateProperty = (propertyId: number) => {
  const config = usePublicConfig();
  return useMutation({
    mutationFn: ({ current, changes }: { current: PropertyDetail; changes: PropertyChanges }) =>
      updateProperty(config, propertyId, toUpdatePropertyRequest(current, changes)),
    onSuccess: async (updated: PropertyBasicInfo) => {
      queryClient.setQueryData<PropertyDetail>(propertyQueryKeys.detail(propertyId), (current) =>
        current === undefined
          ? current
          : {
              ...current,
              name: updated.name,
              depositAmount: updated.depositAmount,
              monthlyRentAmount: updated.monthlyRentAmount,
              discoverySource: updated.discoverySource,
              location: updated.location,
              availableMoveInDate: updated.availableMoveInDate,
              maintenanceFeeAmount: updated.maintenanceFeeAmount,
              visitScheduledAt: updated.visitScheduledAt,
              roomOptions: updated.roomOptions,
              utilityOptions: updated.utilityOptions,
              updatedAt: updated.updatedAt ?? current.updatedAt,
            },
      );
      await queryClient.invalidateQueries({ queryKey: propertyQueryKeys.lists() });
    },
  });
};

export const useSavePropertyMemoDocument = (propertyId: number) => {
  const config = usePublicConfig();
  return useMutation({
    mutationFn: (request: SavePropertyMemoDocumentRequestDto) => savePropertyMemoDocument(config, propertyId, request),
    onSuccess: (memo) => {
      queryClient.setQueryData(propertyQueryKeys.memo(propertyId), memo);
      trackPropertyEvent('property_memo_saved', { property_id: propertyId });
    },
    onError: () => trackPropertyEvent('property_memo_save_failed', { property_id: propertyId, error_kind: 'request' }),
  });
};

export const useRemoveProperty = (propertyId: number) => {
  const config = usePublicConfig();
  return useMutation({
    mutationFn: () => removeProperty(config, propertyId),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: propertyQueryKeys.detail(propertyId) });
      await queryClient.invalidateQueries({ queryKey: propertyQueryKeys.lists() });
    },
  });
};

const invalidatePhotoAggregates = async (propertyId: number) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: propertyQueryKeys.photos(propertyId), exact: true }),
    queryClient.invalidateQueries({ queryKey: propertyQueryKeys.detail(propertyId), exact: true }),
    queryClient.invalidateQueries({ queryKey: propertyQueryKeys.lists() }),
  ]);
};

export const useUploadPropertyPhoto = (propertyId: number) => {
  const config = usePublicConfig();
  return useMutation({
    mutationFn: (file: File) => uploadPropertyPhoto(config, propertyId, file),
    onSuccess: async () => invalidatePhotoAggregates(propertyId),
  });
};

export const useSetRepresentativePropertyPhoto = (propertyId: number) => {
  const config = usePublicConfig();
  return useMutation({
    mutationFn: (photoId: number) => setRepresentativePropertyPhoto(config, propertyId, photoId),
    onSuccess: async () => invalidatePhotoAggregates(propertyId),
  });
};

export const useRemovePropertyPhoto = (propertyId: number) => {
  const config = usePublicConfig();
  return useMutation({
    mutationFn: (photoId: number) => removePropertyPhoto(config, propertyId, photoId),
    onSuccess: async (_, photoId) => {
      queryClient.removeQueries({ queryKey: propertyQueryKeys.photoContent(propertyId, photoId), exact: true });
      await invalidatePhotoAggregates(propertyId);
    },
    onError: async (error) => {
      if (error instanceof Error && 'code' in error && error.code === 'PHOTO_NOT_FOUND') {
        await queryClient.invalidateQueries({ queryKey: propertyQueryKeys.photos(propertyId) });
      }
    },
  });
};
