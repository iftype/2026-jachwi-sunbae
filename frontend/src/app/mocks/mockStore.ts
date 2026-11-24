import { HttpResponse } from 'msw';

import { isChecklistStage } from '@/features/checklist/model/checklist';
import type { ChecklistStage } from '@/features/checklist/model/checklistTypes';
import { CHECKLIST_STAGES } from '@/features/checklist/model/checklistTypes';

export const now = '2026-08-20T05:00:00.000Z';

export const success = (data: unknown, status = 200) =>
  HttpResponse.json({ code: 'SUCCESS', message: '요청에 성공했습니다.', data }, { status });

export const failure = (code: string, status: number) =>
  HttpResponse.json({ code, message: '요청을 처리하지 못했습니다.', errors: [] }, { status });

export const notImplemented = () => failure('NOT_IMPLEMENTED', 501);

export const mockPhotoBase64 = [
  'iVBORw0KGgoAAAANSUhEUgAAAKAAAAB4CAYAAAB1ovlvAAAB4ElEQVR4nO3SsU0EUAwFQRqnAtqgJiIKICBEECAEFRAgdLff5wk2t/zm7vnl6VuquqsP0O4AVBqASgNQaQAqDUClAag0AJUGoNIAVBqASgNQaQAqDUClAag0AJX2L4Bfn+83Vz3ItgAEEMCTqgfZFoAAAnhS9SDbAhBAAE+qHmRbAAII4EnVg2wLQAABPKl6kG0BCCCAJ1UPsi0AAQTwpOpBtgUggACeVD3ItgAEEMCTqgfZFoAAAnhS9SDbAhBAAE+qHmRbAAII4EnVg2wLQAABPKlLPPnh8X5NAAII4OQABBDAwQEIIICTAxBAAAcHIIAATg5AAAEcHIAAAjg5AAEEcHAAAgjg5AAEEMDBAQgggJMDEEAABwcggABODkAAARzcVQEKQAAHVKMAcHk1CgCXV6MAcHk1CgCXV6MAcHk1CgCXV6MAcHk1CgCXV6MAcHk1CgCXV6MAcHk1CgCXV6M4GuDH2+u3LluN4pr99TcAAgjgrVejAHB5NQoAl1ejAFD6JQCVBqDSAFQagEoDUGkAKg1ApQGoNACVBqDSAFQagEoDUGkAKg1ApQGoNACVBqDSAFQagEoDUGkAKg1ApQGoNACVBqDSAFQagEoDUGkAKg1ApQGoNACVBqDSAFTaD3HcMX7tBIM+AAAAAElFTkSuQmCC',
  'iVBORw0KGgoAAAANSUhEUgAAAKAAAAB4CAYAAAB1ovlvAAAB3klEQVR4nO3SIU4DUBBFUbZKECwXR4LF1zVBlhUgCGnvH+aI6yfzztPH+9tNqnqqD9DuAFQagEoDUGkAKg1ApQGoNACVBqDSAFQagEoDUGkAKg1ApQGoNACV9ieAX9fLv6seZFsAAgjgSdWDbAtAAAE8qXqQbQEIIIAnVQ+yLQABBPCk6kG2BSCAAJ5UPci2AAQQwJOqB9kWgAACeFL1INsCEEAAT6oeZFsAAgjgSdWDbAtAAAE8qXqQbQEIIIAnVQ+yLQABBPCk6kG2BSCAAJ7UPZ788vq8JgABBHByAAII4OAABBDAyQEIIICDAxBAACcHIIAADg5AAAGcHIAAAjg4AAEEcHIAAgjg4AAEEMDJAQgggIMDEEAAJwcggAAO7qEABSCAA6pRALi8GgWAy6tRALi8GgWAy6tRALi8GgWAy6tRALi8GgWAy6tRALi8GgWAy6tRALi8GgWAy6tRHA3wevm86b7VKB7Zb38DIIAA/vdqFAAur0YB4PJqFABKPwSg0gBUGoBKA1BpACoNQKUBqDQAlQag0gBUGoBKA1BpACoNQKUBqDQAlQag0gBUGoBKA1BpACoNQKUBqDQAlQag0gBUGoBKA1BpACoNQKUBqDQAlQag0gBUGoBK+wbRpUHiU7hgNQAAAABJRU5ErkJggg==',
] as const;

export const createMockPhotoBytes = (photoId: number) => {
  const encoded = mockPhotoBase64[photoId % mockPhotoBase64.length] ?? mockPhotoBase64[0];
  return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
};

export type MockCheckItem = {
  id: number;
  stage: ChecklistStage;
  itemType: 'CORE' | 'OPTIONAL';
  question: string;
};

export const checkItems: MockCheckItem[] = [
  { id: 101, stage: 'ON_SITE', itemType: 'CORE', question: '관리비에 포함된 항목은 무엇인가요?' },
  { id: 102, stage: 'ON_SITE', itemType: 'CORE', question: '입주 가능한 날짜는 언제인가요?' },
  { id: 103, stage: 'ON_SITE', itemType: 'OPTIONAL', question: '주차가 가능한가요?' },
  { id: 201, stage: 'ON_SITE', itemType: 'CORE', question: '수압이 충분한가요?' },
  { id: 202, stage: 'ON_SITE', itemType: 'CORE', question: '방음 상태는 괜찮은가요?' },
  { id: 203, stage: 'ON_SITE', itemType: 'OPTIONAL', question: '채광이 충분한가요?' },
  { id: 301, stage: 'PRE_CONTRACT', itemType: 'CORE', question: '등기부등본의 소유자가 일치하나요?' },
  { id: 302, stage: 'PRE_CONTRACT', itemType: 'OPTIONAL', question: '특약 사항이 계약서에 반영됐나요?' },
];

export type MockChecklistItem = {
  id: number;
  systemCheckItemId: number | null;
  origin: 'PROVIDED' | 'CUSTOM';
  stage: ChecklistStage;
  itemType: 'CORE' | 'OPTIONAL';
  question: string;
  displayOrder: number;
  active: boolean;
};
export type MockChecklist = {
  id: number;
  name: string;
  stage: ChecklistStage;
  items: MockChecklistItem[];
};

export const checklistItemsFor = (stage: ChecklistStage, ids: number[]) =>
  ids.flatMap((id, index) => {
    const item = checkItems.find((candidate) => candidate.id === id && candidate.stage === stage);
    return item === undefined
      ? []
      : [
          {
            ...item,
            systemCheckItemId: item.id,
            origin: 'PROVIDED' as const,
            displayOrder: index + 1,
            active: true,
          },
        ];
  });

let checklists: MockChecklist[] = [
  {
    id: 7,
    name: '전화 문의 기본 목록',
    stage: 'ON_SITE',
    items: checklistItemsFor('ON_SITE', [101, 102, 103]),
  },
  {
    id: 8,
    name: '집에서 확인할 목록',
    stage: 'ON_SITE',
    items: checklistItemsFor('ON_SITE', [201, 202, 203]),
  },
  {
    id: 9,
    name: '계약 전 마지막 확인',
    stage: 'PRE_CONTRACT',
    items: checklistItemsFor('PRE_CONTRACT', [301, 302]),
  },
];

export const checklistDetail = (checklist: MockChecklist) => ({
  id: checklist.id,
  name: checklist.name,
  stage: checklist.stage,
  itemCount: checklist.items.length,
  // dev API의 사용자 체크리스트 조회 응답에는 origin이 없다.
  items: checklist.items.map(({ stage: _stage, origin: _origin, ...item }) => item),
});

export type MockPhoto = {
  id: number;
  propertyId: number;
  url: string;
  thumbnailUrl: string;
  contentType: 'image/png';
  sizeBytes: number;
  representative: boolean;
  createdAt: string;
};

export type MockProperty = {
  id: number;
  name: string;
  depositAmount: number;
  monthlyRentAmount: number;
  discoverySource: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  availableMoveInDate: string | null;
  maintenanceFeeAmount: number | null;
  visitScheduledAt: string | null;
  roomOptions: string[];
  utilityOptions: string[];
};

/**
 * 목은 회원별로 데이터를 나누지 않아 늘 기록이 있는 회원처럼 답한다. 이 쿠키가 `true`면 매물 목록만 비워
 * 막 들어온 새 익명 회원(기록 없음, 미리보기 매물이 보임)을 흉내 낸다. 검증 스크립트(qa)가 쓴다.
 */
export const MOCK_NEW_MEMBER_COOKIE = 'jachwi-mock-new-member';

let properties: MockProperty[] = [
  {
    id: 10,
    name: '신림역 원룸',
    depositAmount: 10_000_000,
    monthlyRentAmount: 550_000,
    discoverySource: 'https://example.com/listings/10',
    address: '서울 관악구 신림로 12길 3',
    latitude: 37.4841234,
    longitude: 126.9291234,
    availableMoveInDate: '2026-09-01',
    maintenanceFeeAmount: 70_000,
    visitScheduledAt: '2026-08-20T14:00:00',
    roomOptions: ['AIR_CONDITIONER', 'REFRIGERATOR'],
    utilityOptions: ['WATER', 'INTERNET'],
  },
  {
    id: 11,
    name: '망원동 투룸',
    depositAmount: 30_000_000,
    monthlyRentAmount: 750_000,
    discoverySource: null,
    address: '서울 마포구 월드컵로 10길 12',
    latitude: 37.5551234,
    longitude: 126.9101234,
    availableMoveInDate: null,
    maintenanceFeeAmount: null,
    visitScheduledAt: null,
    roomOptions: [],
    utilityOptions: [],
  },
];

export const createMockPhoto = (propertyId: number, photoId: number, representative = false): MockPhoto => ({
  id: photoId,
  propertyId,
  url: `/api/properties/${propertyId}/photos/${photoId}`,
  thumbnailUrl: `/api/properties/${propertyId}/photos/${photoId}/thumbnail`,
  contentType: 'image/png',
  sizeBytes: createMockPhotoBytes(photoId).byteLength,
  representative,
  createdAt: now,
});

let photosByProperty = new Map<number, MockPhoto[]>([
  [10, [createMockPhoto(10, 81, true), createMockPhoto(10, 82)]],
  [11, []],
]);

export const emptyProgress = {
  totalCount: 0,
  completedCount: 0,
  goodCount: 0,
  cautionCount: 0,
  unconfirmedCount: 0,
  progressRate: 0,
};

export type MockAppliedItem = {
  id: number;
  systemCheckItemId: number | null;
  question: string;
  displayOrder: number;
  status: 'UNCONFIRMED' | 'GOOD' | 'CAUTION';
  memo: string;
};

export type MockAppliedChecklist = {
  id: number;
  propertyId: number;
  sourceChecklistId: number | null;
  checklistName: string;
  stage: ChecklistStage;
  items: MockAppliedItem[];
};

let nextAppliedChecklistId = 53;
let nextAppliedItemId = 804;
let appliedByProperty = new Map<number, Map<ChecklistStage, MockAppliedChecklist>>([
  [
    10,
    new Map([
      [
        'ON_SITE',
        {
          id: 51,
          propertyId: 10,
          sourceChecklistId: 7,
          checklistName: '전화 문의 기본 목록',
          stage: 'ON_SITE',
          items: [
            {
              id: 801,
              systemCheckItemId: 101,
              question: '관리비에 포함된 항목은 무엇인가요?',
              displayOrder: 1,
              status: 'GOOD',
              memo: '수도 요금 포함',
            },
            {
              id: 802,
              systemCheckItemId: 102,
              question: '입주 가능한 날짜는 언제인가요?',
              displayOrder: 2,
              status: 'CAUTION',
              memo: '날짜 재확인 필요',
            },
            {
              id: 803,
              systemCheckItemId: 103,
              question: '주차가 가능한가요?',
              displayOrder: 3,
              status: 'UNCONFIRMED',
              memo: '',
            },
          ],
        },
      ],
    ]),
  ],
]);

export const progressFromItems = (items: MockAppliedItem[]) => {
  const completedCount = items.filter((item) => item.status !== 'UNCONFIRMED').length;
  return {
    totalCount: items.length,
    completedCount,
    goodCount: items.filter((item) => item.status === 'GOOD').length,
    cautionCount: items.filter((item) => item.status === 'CAUTION').length,
    unconfirmedCount: items.filter((item) => item.status === 'UNCONFIRMED').length,
    progressRate: items.length === 0 ? 0 : Math.floor((completedCount / items.length) * 100),
  };
};

export const propertyProgress = (propertyId: number) => {
  const items = Array.from(appliedByProperty.get(propertyId)?.values() ?? []).flatMap((checklist) => checklist.items);
  return progressFromItems(items);
};

// 서버는 매물을 네 가지 응답으로 나눠 내려준다. 목이 하나의 넉넉한 응답을 공유하면
// 화면이 실제로는 없는 필드를 읽어도 목 뒤에서는 드러나지 않는다. 그래서 응답마다 따로 만든다.

/** 네 응답이 공통으로 갖는 필드. 서버는 discoverySource 를 null 대신 빈 문자열로 내려준다. */
const propertyIdentity = (property: MockProperty) => ({
  id: property.id,
  name: property.name,
  depositAmount: property.depositAmount,
  monthlyRentAmount: property.monthlyRentAmount,
  discoverySource: property.discoverySource ?? '',
  address: property.address,
  latitude: property.latitude,
  longitude: property.longitude,
});

/** 매물 목록에는 없고 생성·상세·수정 응답에만 있는 부가 정보. 관리비도 null 대신 0으로 내려준다. */
const propertyAdditionalInfo = (property: MockProperty) => ({
  availableMoveInDate: property.availableMoveInDate,
  maintenanceFeeAmount: property.maintenanceFeeAmount ?? 0,
  visitScheduledAt: property.visitScheduledAt,
  roomOptions: property.roomOptions,
  utilityOptions: property.utilityOptions,
});

/** 매물 상세에 실리는 사진은 사진 목록 항목과 달리 propertyId 를 갖지 않는다. */
const detailPhotoResponse = (photo: MockPhoto) => ({
  id: photo.id,
  url: photo.url,
  thumbnailUrl: photo.thumbnailUrl,
  contentType: photo.contentType,
  sizeBytes: photo.sizeBytes,
  representative: photo.representative,
  createdAt: photo.createdAt,
});

/** 대표 사진은 사진 목록 항목과 달리 세 필드만 내려준다. */
const representativePhotoResponse = (photos: MockPhoto[]) => {
  const representative = photos.find((photo) => photo.representative);
  return representative === undefined
    ? null
    : {
        id: representative.id,
        url: representative.url,
        thumbnailUrl: representative.thumbnailUrl,
        contentType: representative.contentType,
      };
};

const propertyStages = (propertyId: number) => {
  const applied = appliedByProperty.get(propertyId) ?? new Map();
  return CHECKLIST_STAGES.map((stage) => {
    const checklist = applied.get(stage);
    return {
      stage,
      applied: checklist !== undefined,
      propertyChecklistId: checklist?.id ?? null,
      checklistName: checklist?.checklistName ?? null,
      sourceChecklistId: checklist?.sourceChecklistId ?? null,
      progress: checklist === undefined ? emptyProgress : progressFromItems(checklist.items),
    };
  });
};

/** GET /api/properties 의 items. 부가 정보와 사진 목록은 들어 있지 않다. */
export const propertyListItemResponse = (property: MockProperty) => {
  const photos = photosByProperty.get(property.id) ?? [];
  return {
    ...propertyIdentity(property),
    photoCount: photos.length,
    representativePhoto: representativePhotoResponse(photos),
    overallProgress: propertyProgress(property.id),
    stages: propertyStages(property.id),
  };
};

/** POST /api/properties. 단계 요약과 photoCount 가 없고, updatedAt 은 항상 createdAt 과 같다. */
export const createPropertyResponse = (property: MockProperty) => ({
  ...propertyIdentity(property),
  ...propertyAdditionalInfo(property),
  createdAt: now,
  updatedAt: now,
  photos: (photosByProperty.get(property.id) ?? []).map(detailPhotoResponse),
  overallProgress: propertyProgress(property.id),
});

/** GET /api/properties/{id}. 단계 요약이 없다. 단계는 체크리스트 현황 API 가 따로 내려준다. */
export const propertyDetailResponse = (property: MockProperty) => {
  const photos = photosByProperty.get(property.id) ?? [];
  return {
    ...propertyIdentity(property),
    ...propertyAdditionalInfo(property),
    photoCount: photos.length,
    photos: photos.map(detailPhotoResponse),
    representativePhoto: representativePhotoResponse(photos),
    overallProgress: propertyProgress(property.id),
    createdAt: now,
    updatedAt: now,
  };
};

/** PUT /api/properties/{id}. 사진·진행률·createdAt 없이 updatedAt 만 붙는다. */
export const updatePropertyResponse = (property: MockProperty) => ({
  ...propertyIdentity(property),
  ...propertyAdditionalInfo(property),
  updatedAt: now,
});

export type MockMemo = {
  propertyId: number;
  freeMemo: string;
};

let memoByProperty = new Map<number, MockMemo>([
  [10, { propertyId: 10, freeMemo: '관리비 포함 항목을 다시 확인하기' }],
]);

export const readPositiveInteger = (value: string | readonly string[] | undefined) => {
  if (typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const readStage = (value: string | readonly string[] | undefined) =>
  typeof value === 'string' && isChecklistStage(value) ? value : null;

export const getProperty = (value: string | readonly string[] | undefined) => {
  const id = readPositiveInteger(value);
  return id === null ? undefined : properties.find((property) => property.id === id);
};

export const obsoleteEndpoint = () => failure('API_CONTRACT_REMOVED', 410);

export const hasDuplicates = (values: number[]) => new Set(values).size !== values.length;

export const getMockChecklists = () => checklists;
export const setMockChecklists = (next: MockChecklist[]) => {
  checklists = next;
};

export const getMockProperties = () => properties;
export const setMockProperties = (next: MockProperty[]) => {
  properties = next;
};

export const getMockPhotosByProperty = () => photosByProperty;
export const setMockPhotosByProperty = (next: Map<number, MockPhoto[]>) => {
  photosByProperty = next;
};

export const getMockMemosByProperty = () => memoByProperty;
export const setMockMemosByProperty = (next: Map<number, MockMemo>) => {
  memoByProperty = next;
};

export const getMockAppliedByProperty = () => appliedByProperty;
export const setMockAppliedByProperty = (next: Map<number, Map<ChecklistStage, MockAppliedChecklist>>) => {
  appliedByProperty = next;
};

export const takeNextAppliedChecklistId = () => nextAppliedChecklistId++;
export const takeNextAppliedItemId = () => nextAppliedItemId++;

const initialChecklists = structuredClone(checklists);
const initialProperties = structuredClone(properties);
const initialPhotosByProperty = structuredClone(photosByProperty);
const initialMemoByProperty = structuredClone(memoByProperty);
const initialAppliedByProperty = structuredClone(appliedByProperty);

/** 북마크한 행정동 코드. 최근에 추가한 순서다. */
let bookmarkedAdminDongs: string[] = [];
export const readBookmarkedAdminDongs = () => bookmarkedAdminDongs;
export const writeBookmarkedAdminDongs = (codes: string[]) => {
  bookmarkedAdminDongs = codes;
};

export const resetMockStore = () => {
  bookmarkedAdminDongs = [];
  checklists = structuredClone(initialChecklists);
  properties = structuredClone(initialProperties);
  photosByProperty = structuredClone(initialPhotosByProperty);
  memoByProperty = structuredClone(initialMemoByProperty);
  appliedByProperty = structuredClone(initialAppliedByProperty);
  nextAppliedChecklistId = 53;
  nextAppliedItemId = 804;
};
