import {
  readArray,
  readBoolean,
  readInteger,
  readNullableInteger,
  readNullableString,
  readRecord,
  readString,
  readUtcDateTime,
} from '@/shared/api/responseParsers';

import type {
  CreatedProperty,
  DiscoverySource,
  PropertyAdditionalInfo,
  PropertyAiImport,
  PropertyBasicInfo,
  PropertyChecklistDetail,
  PropertyChecklistItemStatus,
  PropertyChecklistOverview,
  PropertyChecklistProgress,
  PropertyChecklistStageSummary,
  PropertyCommuteStatus,
  PropertyCommuteTimes,
  PropertyDetail,
  PropertyLocation,
  PropertyMemoDocument,
  PropertyPage,
  PropertyPhoto,
  PropertyPhotoList,
  PropertyPhotoPreview,
  PropertySummary,
  RoomOption,
  UtilityOption,
} from '../model/Property';
import { PROPERTY_CHECKLIST_CATEGORIES } from '../model/Property';

const parseDiscoverySource = (value: unknown): DiscoverySource => {
  if (value === null) return { type: 'TEXT', value: '' };
  if (typeof value === 'string') {
    return { type: /^https?:\/\//i.test(value) ? 'URL' : 'TEXT', value };
  }
  if (value === undefined || typeof value !== 'object' || Array.isArray(value)) {
    return { type: 'TEXT', value: '' };
  }
  const record = readRecord(value);
  const type = record.type;

  if (type === 'URL' || type === 'TEXT') {
    const sourceValue = typeof record.value === 'string' ? record.value : '';
    return { type, value: sourceValue };
  }

  return { type: 'TEXT', value: '' };
};

const readDetailInteger = (record: Record<string, unknown>, key: string): number => {
  const value = record[key];
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : 0;
};

const readDetailString = (record: Record<string, unknown>, key: string, fallback: string): string => {
  const value = record[key];
  return typeof value === 'string' ? value : fallback;
};

const parsePropertyLocation = (record: Record<string, unknown>): PropertyLocation => {
  const nullableText = (key: string): string | null => {
    const value = record[key];
    return typeof value === 'string' && value.trim() !== '' ? value : null;
  };
  const nullableCoordinate = (key: string): number | null => {
    const value = record[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  };
  return {
    address: nullableText('address'),
    latitude: nullableCoordinate('latitude'),
    longitude: nullableCoordinate('longitude'),
  };
};

const ROOM_OPTIONS: RoomOption[] = [
  'AIR_CONDITIONER',
  'REFRIGERATOR',
  'WASHING_MACHINE',
  'SINK',
  'GAS_STOVE',
  'MICROWAVE',
  'SHOE_CABINET',
  'WARDROBE',
  'BED',
  'DESK',
  'TV',
  'INDUCTION',
];
const UTILITY_OPTIONS: UtilityOption[] = ['WATER', 'ELECTRICITY', 'GAS', 'INTERNET'];

const readNullableNumber = (record: Record<string, unknown>, key: string): number | null => {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new Error(`${key} 값이 올바르지 않습니다.`);
  return value;
};

const readNullableDate = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key];
  if (value === null) return null;
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  ) {
    throw new Error(`${key} 날짜 응답이 올바르지 않습니다.`);
  }
  return value;
};

const readNullableLocalDateTime = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/.test(value)) {
    throw new Error(`${key} 일시 응답이 올바르지 않습니다.`);
  }
  return value;
};

const readEnumArray = <T extends string>(record: Record<string, unknown>, key: string, values: T[]): T[] => {
  const input = record[key];
  if (!Array.isArray(input) || input.some((value) => typeof value !== 'string' || !values.includes(value as T))) {
    throw new Error(`${key} 목록 응답이 올바르지 않습니다.`);
  }
  return input as T[];
};

const parsePropertyAdditionalInfo = (record: Record<string, unknown>): PropertyAdditionalInfo => ({
  availableMoveInDate: readNullableDate(record, 'availableMoveInDate'),
  maintenanceFeeAmount: readNullableNumber(record, 'maintenanceFeeAmount'),
  visitScheduledAt: readNullableLocalDateTime(record, 'visitScheduledAt'),
  roomOptions: readEnumArray(record, 'roomOptions', ROOM_OPTIONS),
  utilityOptions: readEnumArray(record, 'utilityOptions', UTILITY_OPTIONS),
});

const readOptionalUtcDateTime = (record: Record<string, unknown>, key: string): string =>
  typeof record[key] === 'string' ? readUtcDateTime(record, key) : '1970-01-01T00:00:00Z';

const parseDetailPhoto = (value: unknown): PropertyPhotoPreview | null => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const photoId = readDetailInteger(record, 'id') || readDetailInteger(record, 'photoId');
  const contentUrl = readDetailString(record, 'url', readDetailString(record, 'contentUrl', ''));
  if (photoId < 1 || contentUrl === '') return null;

  const rawCreatedAt = record.createdAt ?? record.created_at;
  const createdAt =
    typeof rawCreatedAt === 'string'
      ? (() => {
          try {
            return readUtcDateTime({ createdAt: rawCreatedAt }, 'createdAt');
          } catch {
            return '1970-01-01T00:00:00Z';
          }
        })()
      : '1970-01-01T00:00:00Z';

  return {
    photoId,
    contentUrl,
    thumbnailUrl: typeof record.thumbnailUrl === 'string' ? readString(record, 'thumbnailUrl') : contentUrl,
    createdAt,
  };
};

const parsePropertySummary = (value: unknown): PropertySummary => {
  const record = readRecord(value);
  const representativePhoto = record.representativePhoto;
  const parsedRepresentativePhoto =
    representativePhoto === null || representativePhoto === undefined
      ? null
      : (() => {
          const photo = readRecord(representativePhoto);
          const rawContentType = readString(photo, 'contentType');
          if (rawContentType !== 'image/jpeg' && rawContentType !== 'image/png' && rawContentType !== 'image/webp') {
            throw new Error('대표 사진 형식 응답이 올바르지 않습니다.');
          }
          const contentType: 'image/jpeg' | 'image/png' | 'image/webp' = rawContentType;
          return {
            photoId: readInteger(photo, 'id', 1),
            contentUrl: readString(photo, 'url'),
            thumbnailUrl:
              typeof photo.thumbnailUrl === 'string' ? readString(photo, 'thumbnailUrl') : readString(photo, 'url'),
            contentType,
          };
        })();

  return {
    propertyId: readInteger(record, 'id', 1),
    name: readString(record, 'name'),
    depositAmount: readInteger(record, 'depositAmount'),
    monthlyRentAmount: readInteger(record, 'monthlyRentAmount'),
    discoverySource: parseDiscoverySource(record.discoverySource),
    location: parsePropertyLocation(record),
    representativePhoto: parsedRepresentativePhoto,
    progress: parsePropertyChecklistProgress(record.overallProgress),
    stages: Array.isArray(record.stages) ? record.stages.map(parsePropertyChecklistStageSummary) : [],
    photoCount: typeof record.photoCount === 'number' ? readInteger(record, 'photoCount') : 0,
  };
};

export const parsePropertyPage = (value: unknown): PropertyPage => {
  const record = readRecord(value);
  const content = readArray(record, 'items').map(parsePropertySummary);
  const totalElements = readInteger(record, 'totalCount');
  if (content.length !== totalElements) throw new Error('매물 목록 집계 응답이 올바르지 않습니다.');

  return {
    content,
    page: 0,
    size: Math.max(1, content.length),
    totalElements,
    totalPages: totalElements === 0 ? 0 : 1,
    hasNext: false,
  };
};

export const parsePropertyDetail = (value: unknown): PropertyDetail => {
  const record = readRecord(value);
  const photos = Array.isArray(record.photos)
    ? record.photos.flatMap((photo) => {
        const parsedPhoto = parseDetailPhoto(photo);
        return parsedPhoto === null ? [] : [parsedPhoto];
      })
    : [];

  return {
    propertyId: readDetailInteger(record, 'propertyId') || readDetailInteger(record, 'id'),
    name: readDetailString(record, 'name', '이름 없는 매물'),
    depositAmount: readDetailInteger(record, 'depositAmount'),
    monthlyRentAmount: readDetailInteger(record, 'monthlyRentAmount'),
    discoverySource: parseDiscoverySource(record.discoverySource),
    location: parsePropertyLocation(record),
    ...parsePropertyAdditionalInfo(record),
    photoPreview: {
      totalCount: typeof record.photoCount === 'number' ? readInteger(record, 'photoCount') : photos.length,
      photos,
    },
    createdAt: readOptionalUtcDateTime(record, 'createdAt'),
    updatedAt: readOptionalUtcDateTime(record, 'updatedAt'),
  };
};

export const parsePropertyBasicInfo = (value: unknown): PropertyBasicInfo => {
  const record = readRecord(value);
  return {
    propertyId:
      typeof record.propertyId === 'number' ? readInteger(record, 'propertyId', 1) : readInteger(record, 'id', 1),
    name: readString(record, 'name'),
    depositAmount: readInteger(record, 'depositAmount'),
    monthlyRentAmount: readInteger(record, 'monthlyRentAmount'),
    discoverySource: parseDiscoverySource(record.discoverySource),
    location: parsePropertyLocation(record),
    ...parsePropertyAdditionalInfo(record),
    updatedAt:
      typeof record.updatedAt === 'string'
        ? readUtcDateTime(record, 'updatedAt')
        : typeof record.createdAt === 'string'
          ? readUtcDateTime(record, 'createdAt')
          : null,
  };
};

export const parseCreatedProperty = (value: unknown): CreatedProperty => {
  const record = readRecord(value);
  return parsePropertyBasicInfo(record);
};

export const parsePropertyAiImport = (value: unknown): PropertyAiImport => {
  const record = readRecord(value);
  return {
    basicInfo: parsePropertyBasicInfo(record.property),
    freeMemo: readString(record, 'freeMemo', { allowEmpty: true, maximumCodePoints: 2_000 }),
  };
};

export const parsePropertyMemoDocument = (value: unknown): PropertyMemoDocument => {
  const record = readRecord(value);
  return {
    propertyId: readInteger(record, 'propertyId', 1),
    freeMemo: readString(record, 'freeMemo', { allowEmpty: true, maximumCodePoints: 2_000 }),
  };
};

const parsePropertyChecklistProgress = (value: unknown): PropertyChecklistProgress => {
  const record = readRecord(value);
  return {
    totalCount: readInteger(record, 'totalCount'),
    completedCount: readInteger(record, 'completedCount'),
    goodCount: readInteger(record, 'goodCount'),
    cautionCount: readInteger(record, 'cautionCount'),
    unconfirmedCount: readInteger(record, 'unconfirmedCount'),
    progressRate: readInteger(record, 'progressRate'),
  };
};

const parsePropertyChecklistStageSummary = (value: unknown): PropertyChecklistStageSummary => {
  const stageRecord = readRecord(value);
  const stage = readString(stageRecord, 'stage');
  if (stage !== 'ON_SITE' && stage !== 'PRE_CONTRACT') {
    throw new Error('체크리스트 단계가 올바르지 않습니다.');
  }
  return {
    stage,
    applied: readBoolean(stageRecord, 'applied'),
    propertyChecklistId: readNullableInteger(stageRecord, 'propertyChecklistId', 1),
    checklistName: readNullableString(stageRecord, 'checklistName'),
    sourceChecklistId: readNullableInteger(stageRecord, 'sourceChecklistId', 1),
    progress: parsePropertyChecklistProgress(stageRecord.progress),
  };
};

export const parsePropertyChecklistOverview = (value: unknown): PropertyChecklistOverview => {
  const record = readRecord(value);
  return {
    propertyId: readInteger(record, 'propertyId', 1),
    overallProgress: parsePropertyChecklistProgress(record.overallProgress),
    stages: readArray(record, 'stages').map(parsePropertyChecklistStageSummary),
  };
};

const parsePropertyChecklistItemStatus = (value: unknown): PropertyChecklistItemStatus => {
  if (value !== 'UNCONFIRMED' && value !== 'GOOD' && value !== 'CAUTION') {
    throw new Error('체크리스트 항목 상태가 올바르지 않습니다.');
  }
  return value;
};

const parsePropertyChecklistCategory = (value: unknown) => {
  if (value === undefined) return undefined;
  const category = PROPERTY_CHECKLIST_CATEGORIES.find((category) => category === value);
  if (category === undefined) throw new Error('체크리스트 카테고리가 올바르지 않습니다.');
  return category;
};

export const parsePropertyChecklistDetail = (value: unknown): PropertyChecklistDetail => {
  const record = readRecord(value);
  const stage = readString(record, 'stage');
  if (stage !== 'ON_SITE' && stage !== 'PRE_CONTRACT') {
    throw new Error('체크리스트 단계가 올바르지 않습니다.');
  }
  return {
    propertyChecklistId: readInteger(record, 'id', 1),
    propertyId: readInteger(record, 'propertyId', 1),
    sourceChecklistId: readNullableInteger(record, 'sourceChecklistId', 1),
    checklistName: readString(record, 'checklistName'),
    stage,
    items: readArray(record, 'items')
      .map((value) => {
        const item = readRecord(value);
        return {
          itemId: readInteger(item, 'id', 1),
          systemCheckItemId: readNullableInteger(item, 'systemCheckItemId', 1),
          question: readString(item, 'question', { maximumCodePoints: 200 }),
          displayOrder: readInteger(item, 'displayOrder', 1),
          status: parsePropertyChecklistItemStatus(item.status),
          memo: readString(item, 'memo', { allowEmpty: true, maximumCodePoints: 500 }),
          category: parsePropertyChecklistCategory(item.category),
        };
      })
      .sort((a, b) => a.displayOrder - b.displayOrder),
  };
};

const parsePropertyPhoto = (value: unknown): PropertyPhoto => {
  const record = readRecord(value);
  const contentType = readString(record, 'contentType');

  if (contentType !== 'image/jpeg' && contentType !== 'image/png' && contentType !== 'image/webp') {
    throw new Error('사진 형식 응답이 올바르지 않습니다.');
  }

  return {
    photoId: typeof record.photoId === 'number' ? readInteger(record, 'photoId', 1) : readInteger(record, 'id', 1),
    thumbnailUrl:
      typeof record.thumbnailUrl === 'string'
        ? readString(record, 'thumbnailUrl')
        : typeof record.contentUrl === 'string'
          ? readString(record, 'contentUrl')
          : readString(record, 'url'),
    contentUrl: typeof record.contentUrl === 'string' ? readString(record, 'contentUrl') : readString(record, 'url'),
    contentType,
    sizeBytes: readInteger(record, 'sizeBytes', 1),
    createdAt: readUtcDateTime(record, 'createdAt'),
    representative: typeof record.representative === 'boolean' ? readBoolean(record, 'representative') : undefined,
  };
};

export const parsePropertyPhotoResponse = parsePropertyPhoto;

export const parsePropertyPhotoList = (value: unknown): PropertyPhotoList => {
  const record = readRecord(value);

  const photos = Array.isArray(record.photos) ? readArray(record, 'photos') : readArray(record, 'items');
  return { photos: photos.map(parsePropertyPhoto), totalCount: readInteger(record, 'totalCount') };
};

export const parseNoContent = (value: unknown): undefined => {
  if (value !== undefined && value !== null) {
    throw new Error('본문 없는 응답이 필요합니다.');
  }

  return undefined;
};

const COMMUTE_STATUSES = ['REACHABLE', 'UNREACHABLE', 'NO_LOCATION'] as const;

export const parsePropertyCommuteTimes = (value: unknown): PropertyCommuteTimes => {
  const record = readRecord(value);
  return {
    maxMinutes: readInteger(record, 'maxMinutes', 1),
    maxTransfers: readInteger(record, 'maxTransfers'),
    properties: readArray(record, 'properties').map((item) => {
      const property = readRecord(item);
      const status = property.status;
      if (!COMMUTE_STATUSES.some((candidate) => candidate === status))
        throw new Error('매물 통근 상태가 올바르지 않습니다.');
      const commuteMinutes = readNullableInteger(property, 'commuteMinutes');
      if ((status === 'REACHABLE') !== (commuteMinutes !== null))
        throw new Error('매물 통근 시간이 상태와 맞지 않습니다.');
      return {
        propertyId: readInteger(property, 'propertyId', 1),
        // 예전 응답에는 이름이 없을 수 있어 빈 이름으로 받는다. 화면은 이름이 없는 매물을 목록에 넣지 않는다.
        propertyName: typeof property.propertyName === 'string' ? property.propertyName : '',
        status: status as PropertyCommuteStatus,
        commuteMinutes,
      };
    }),
  };
};
