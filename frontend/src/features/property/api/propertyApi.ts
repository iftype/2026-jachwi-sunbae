import { apiBlobRequest, apiRequest } from '@/features/auth/api/apiClient';
import { readInteger, readRecord, readString } from '@/shared/api/responseParsers';
import type { PublicConfig } from '@/shared/config/publicConfigTypes';

import type {
  CreatedProperty,
  PropertyAiImport,
  PropertyBasicInfo,
  PropertyChecklistDetail,
  PropertyChecklistItemStatus,
  PropertyChecklistOverview,
  PropertyCommuteTimes,
  PropertyDetail,
  PropertyMemoDocument,
  PropertyPage,
} from '../model/Property';
import type {
  PropertyInputDto,
  SavePropertyMemoDocumentRequestDto,
  UpdatePropertyRequestDto,
} from './dtos/PropertyDto';
import {
  parseCreatedProperty,
  parseNoContent,
  parsePropertyAiImport,
  parsePropertyBasicInfo,
  parsePropertyChecklistDetail,
  parsePropertyChecklistOverview,
  parsePropertyCommuteTimes,
  parsePropertyDetail,
  parsePropertyMemoDocument,
  parsePropertyPage,
} from './propertyParsers';

export type PropertySearch = {
  query: string;
  page: number;
  size?: number;
};

export const fetchProperties = (
  config: PublicConfig,
  { query }: PropertySearch,
  signal?: AbortSignal,
): Promise<PropertyPage> => {
  const trimmedQuery = query.trim();
  return apiRequest({ config, path: '/api/properties', signal, parseData: parsePropertyPage }).then((page) => {
    if (trimmedQuery.length === 0) return page;
    const content = page.content.filter((property) => property.name.includes(trimmedQuery));
    return {
      ...page,
      content,
      size: Math.max(1, content.length),
      totalElements: content.length,
      totalPages: content.length === 0 ? 0 : 1,
    };
  });
};

/** 내 매물마다 목적지까지 대중교통 통근 시간. 서버가 최대 60분·환승 2회로 고정해 계산한다. */
export const fetchPropertyCommuteTimes = (
  config: PublicConfig,
  destination: { latitude: number; longitude: number },
  signal?: AbortSignal,
): Promise<PropertyCommuteTimes> =>
  apiRequest({
    config,
    path: `/api/properties/commute-times?${new URLSearchParams({
      latitude: String(destination.latitude),
      longitude: String(destination.longitude),
    })}`,
    signal,
    parseData: parsePropertyCommuteTimes,
  });

export const fetchPropertyCsv = (config: PublicConfig, signal?: AbortSignal): Promise<Blob> =>
  apiBlobRequest({ config, path: '/api/properties/export.csv', acceptedContentTypes: ['text/csv'], signal });

export const fetchPropertyComparisonPdf = (
  config: PublicConfig,
  propertyIds: number[],
  signal?: AbortSignal,
): Promise<Blob> =>
  apiBlobRequest({
    config,
    path: '/api/properties/export.pdf',
    method: 'POST',
    body: { propertyIds },
    acceptedContentTypes: ['application/pdf'],
    signal,
  });

export const recordPropertyComparisonView = (config: PublicConfig): Promise<undefined> =>
  apiRequest({
    config,
    path: '/api/properties/comparison-views',
    method: 'POST',
    parseData: parseNoContent,
  });

export const createProperty = (config: PublicConfig, request: PropertyInputDto): Promise<CreatedProperty> =>
  apiRequest({
    config,
    path: '/api/properties',
    method: 'POST',
    body: request,
    parseData: parseCreatedProperty,
  });

export const fetchPropertyDetail = (
  config: PublicConfig,
  propertyId: number,
  signal?: AbortSignal,
): Promise<PropertyDetail> =>
  apiRequest({ config, path: `/api/properties/${propertyId}`, signal, parseData: parsePropertyDetail });

export const updateProperty = (
  config: PublicConfig,
  propertyId: number,
  request: UpdatePropertyRequestDto,
): Promise<PropertyBasicInfo> =>
  apiRequest({
    config,
    path: `/api/properties/${propertyId}`,
    method: 'PUT',
    body: request,
    parseData: parsePropertyBasicInfo,
  });

/** 매물 캡처 이미지를 분석해 매물 정보와 메모를 서버에 바로 저장한다. */
export const importPropertyFromImages = (
  config: PublicConfig,
  propertyId: number,
  files: File[],
): Promise<PropertyAiImport> => {
  const formData = new FormData();
  files.forEach((file) => formData.append('images', file));

  return apiRequest({
    config,
    path: `/api/properties/${propertyId}/ai-import`,
    method: 'POST',
    formData,
    parseData: parsePropertyAiImport,
  });
};

export const fetchPropertyMemo = (
  config: PublicConfig,
  propertyId: number,
  signal?: AbortSignal,
): Promise<PropertyMemoDocument> =>
  apiRequest({
    config,
    path: `/api/properties/${propertyId}/memo`,
    signal,
    parseData: parsePropertyMemoDocument,
  });

export const savePropertyMemoDocument = (
  config: PublicConfig,
  propertyId: number,
  request: SavePropertyMemoDocumentRequestDto,
): Promise<PropertyMemoDocument> =>
  apiRequest({
    config,
    path: `/api/properties/${propertyId}/memo`,
    method: 'PUT',
    body: request,
    parseData: parsePropertyMemoDocument,
  });

export const fetchPropertyChecklistOverview = (
  config: PublicConfig,
  propertyId: number,
  signal?: AbortSignal,
): Promise<PropertyChecklistOverview> =>
  apiRequest({
    config,
    path: `/api/properties/${propertyId}/checklists`,
    signal,
    parseData: parsePropertyChecklistOverview,
  });

export const fetchPropertyChecklistDetail = (
  config: PublicConfig,
  propertyId: number,
  propertyChecklistId: number,
  signal?: AbortSignal,
): Promise<PropertyChecklistDetail> =>
  apiRequest({
    config,
    path: `/api/properties/${propertyId}/checklists/${propertyChecklistId}`,
    signal,
    parseData: (value) => {
      const result = parsePropertyChecklistDetail(value);
      if (result.propertyId !== propertyId || result.propertyChecklistId !== propertyChecklistId) {
        throw new Error('매물 체크리스트 응답이 요청과 다릅니다.');
      }
      return result;
    },
  });

export const updatePropertyChecklistItemStatus = (
  config: PublicConfig,
  propertyId: number,
  propertyChecklistId: number,
  itemId: number,
  status: PropertyChecklistItemStatus,
): Promise<{ itemId: number; status: PropertyChecklistItemStatus }> =>
  apiRequest({
    config,
    path: `/api/properties/${propertyId}/checklists/${propertyChecklistId}/items/${itemId}/status`,
    method: 'PATCH',
    body: { status },
    parseData: (value) => {
      const record = readRecord(value);
      const item = readRecord(record.item);
      const resultStatus = readString(item, 'status');
      if (resultStatus !== 'UNCONFIRMED' && resultStatus !== 'GOOD' && resultStatus !== 'CAUTION') {
        throw new Error('체크리스트 항목 상태 응답이 올바르지 않습니다.');
      }
      return { itemId: readInteger(item, 'id', 1), status: resultStatus };
    },
  });

export const updatePropertyChecklistItemMemo = (
  config: PublicConfig,
  propertyId: number,
  propertyChecklistId: number,
  itemId: number,
  memo: string,
): Promise<{ itemId: number; memo: string }> =>
  apiRequest({
    config,
    path: `/api/properties/${propertyId}/checklists/${propertyChecklistId}/items/${itemId}/memo`,
    method: 'PATCH',
    body: { memo },
    parseData: (value) => {
      const record = readRecord(value);
      const item = readRecord(record.item);
      return {
        itemId: readInteger(item, 'id', 1),
        memo: readString(item, 'memo', { allowEmpty: true, maximumCodePoints: 500 }),
      };
    },
  });

export const removeProperty = (config: PublicConfig, propertyId: number): Promise<undefined> =>
  apiRequest({
    config,
    path: `/api/properties/${propertyId}`,
    method: 'DELETE',
    parseData: parseNoContent,
  });
