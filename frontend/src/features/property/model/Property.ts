import type { ChecklistStage } from '@/features/checklist/model/checklistTypes';

export type DiscoverySource = {
  type: 'URL' | 'TEXT';
  value: string;
};

/** 새 API는 도로명·지번 구분 없는 단일 주소만 내려준다. 지도 검색 결과(MapAddress)와는 별개다. */
export type PropertyLocation = {
  address: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type RoomOption =
  | 'AIR_CONDITIONER'
  | 'REFRIGERATOR'
  | 'WASHING_MACHINE'
  | 'SINK'
  | 'GAS_STOVE'
  | 'MICROWAVE'
  | 'SHOE_CABINET'
  | 'WARDROBE'
  | 'BED'
  | 'DESK'
  | 'TV'
  | 'INDUCTION';

export type UtilityOption = 'WATER' | 'ELECTRICITY' | 'GAS' | 'INTERNET';

export type PropertyAdditionalInfo = {
  availableMoveInDate: string | null;
  maintenanceFeeAmount: number | null;
  visitScheduledAt: string | null;
  roomOptions: RoomOption[];
  utilityOptions: UtilityOption[];
};

export type PropertySummary = {
  propertyId: number;
  name: string;
  depositAmount: number;
  monthlyRentAmount: number;
  discoverySource: DiscoverySource;
  location: PropertyLocation;
  representativePhoto: {
    photoId: number;
    contentUrl: string;
    thumbnailUrl: string;
    contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  } | null;
  photos?: Array<{
    photoId: number;
    contentUrl: string;
    thumbnailUrl: string;
    contentType?: 'image/jpeg' | 'image/png' | 'image/webp';
  }>;
  photoUrls?: string[];
  progress: PropertyChecklistProgress;
  stages: PropertyChecklistStageSummary[];
  photoCount: number;
};

/** 매물별 통근 시간. REACHABLE일 때만 분이 있고, 60분 안에 못 가면 UNREACHABLE, 위치가 없으면 NO_LOCATION이다. */
export type PropertyCommuteStatus = 'REACHABLE' | 'UNREACHABLE' | 'NO_LOCATION';
export type PropertyCommuteTime = {
  propertyId: number;
  propertyName: string;
  status: PropertyCommuteStatus;
  commuteMinutes: number | null;
};
export type PropertyCommuteTimes = {
  maxMinutes: number;
  maxTransfers: number;
  properties: PropertyCommuteTime[];
};

export type PropertyPage = {
  content: PropertySummary[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
};

export type PropertyPhotoPreview = {
  photoId: number;
  contentUrl: string;
  thumbnailUrl: string;
  createdAt: string;
};

export type PropertyDetail = PropertyAdditionalInfo & {
  propertyId: number;
  name: string;
  depositAmount: number;
  monthlyRentAmount: number;
  discoverySource: DiscoverySource;
  location: PropertyLocation;
  photoPreview: {
    totalCount: number;
    photos: PropertyPhotoPreview[];
  };
  createdAt: string;
  updatedAt: string;
};

export type PropertyBasicInfo = PropertyAdditionalInfo & {
  propertyId: number;
  name: string;
  depositAmount: number;
  monthlyRentAmount: number;
  discoverySource: DiscoverySource;
  location: PropertyLocation;
  updatedAt: string | null;
};

export type CreatedProperty = PropertyBasicInfo;

/** 이미지 분석 결과를 반영해 저장한 매물 기본 정보와 추출 메모를 덧붙인 자유 메모. */
export type PropertyAiImport = {
  basicInfo: PropertyBasicInfo;
  freeMemo: string;
};

export type PropertyPhoto = {
  photoId: number;
  contentUrl: string;
  thumbnailUrl: string;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  sizeBytes: number;
  createdAt: string;
  representative?: boolean;
};

export type PropertyPhotoList = {
  photos: PropertyPhoto[];
  totalCount: number;
};

export type PropertyMemoDocument = {
  propertyId: number;
  freeMemo: string;
};

export type PropertyChecklistProgress = {
  totalCount: number;
  completedCount: number;
  goodCount: number;
  cautionCount: number;
  unconfirmedCount: number;
  progressRate: number;
};

export type PropertyChecklistStageSummary = {
  stage: ChecklistStage;
  applied: boolean;
  propertyChecklistId: number | null;
  checklistName: string | null;
  sourceChecklistId: number | null;
  progress: PropertyChecklistProgress;
};

export type PropertyChecklistOverview = {
  propertyId: number;
  overallProgress: PropertyChecklistProgress;
  stages: PropertyChecklistStageSummary[];
};

export type PropertyChecklistItemStatus = 'UNCONFIRMED' | 'GOOD' | 'CAUTION';

export const PROPERTY_CHECKLIST_CATEGORIES = [
  'SECURITY',
  'WINDOW_LIGHT',
  'WATER_BATHROOM',
  'ROOM_CONDITION',
  'BASIC_OPTIONS',
  'OTHER',
] as const;

export type PropertyChecklistCategory = (typeof PROPERTY_CHECKLIST_CATEGORIES)[number];

export type PropertyChecklistItem = {
  itemId: number;
  systemCheckItemId: number | null;
  question: string;
  displayOrder: number;
  status: PropertyChecklistItemStatus;
  memo: string;
  /** 카테고리를 제공하지 않는 이전 API 응답과도 호환한다. */
  category?: PropertyChecklistCategory;
};

export type PropertyChecklistDetail = {
  propertyChecklistId: number;
  propertyId: number;
  sourceChecklistId: number | null;
  checklistName: string;
  stage: ChecklistStage;
  items: PropertyChecklistItem[];
};
