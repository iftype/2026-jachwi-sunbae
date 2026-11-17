import { http, HttpResponse } from 'msw';

import { distanceMeters } from '@/features/map/lib/mapViewportQuery';

import {
  createMockPhotoBytes,
  createPropertyResponse,
  failure,
  getMockMemosByProperty,
  getMockPhotosByProperty,
  getMockProperties,
  getProperty,
  notImplemented,
  obsoleteEndpoint,
  propertyDetailResponse,
  propertyListItemResponse,
  propertyProgress,
  readPositiveInteger,
  setMockMemosByProperty,
  setMockPhotosByProperty,
  setMockProperties,
  success,
  updatePropertyResponse,
} from '../mockStore';

/** jsdom 테스트에서는 request.formData()가 File 파트를 읽지 못해 multipart 본문에서 images 파트 수만 센다. */
export const countImageParts = (multipartBody: string) => multipartBody.match(/name="images"/g)?.length ?? 0;

type PropertyWriteRequest = {
  name: string;
  depositAmount?: number;
  monthlyRentAmount?: number;
  discoverySource?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  availableMoveInDate?: string | null;
  maintenanceFeeAmount?: number | null;
  visitScheduledAt?: string | null;
  roomOptions?: string[];
  utilityOptions?: string[];
};

const propertyFromRequest = (body: PropertyWriteRequest) => ({
  name: body.name,
  depositAmount: body.depositAmount ?? 0,
  monthlyRentAmount: body.monthlyRentAmount ?? 0,
  discoverySource: body.discoverySource ?? null,
  address: body.address ?? null,
  latitude: body.latitude ?? null,
  longitude: body.longitude ?? null,
  availableMoveInDate: body.availableMoveInDate ?? null,
  maintenanceFeeAmount: body.maintenanceFeeAmount ?? null,
  visitScheduledAt: body.visitScheduledAt ?? null,
  roomOptions: body.roomOptions ?? [],
  utilityOptions: body.utilityOptions ?? [],
});

// 서버처럼 최대 60분·환승 2회로 고정한다. 시간은 직선거리 400m당 1분에 정류장까지 걷는 5분을 더해 어림한다.
const COMMUTE_MAX_MINUTES = 60;
const COMMUTE_MAX_TRANSFERS = 2;

export const propertyHandlers = [
  // `/api/properties/:propertyId`보다 먼저 두어야 `commute-times`를 매물 ID로 읽지 않는다.
  http.get('*/api/properties/commute-times', ({ request }) => {
    const params = new URL(request.url).searchParams;
    const latitude = Number(params.get('latitude'));
    const longitude = Number(params.get('longitude'));
    if (
      !params.has('latitude') ||
      !params.has('longitude') ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    )
      return failure('INVALID_REQUEST', 400);
    return success({
      maxMinutes: COMMUTE_MAX_MINUTES,
      maxTransfers: COMMUTE_MAX_TRANSFERS,
      properties: [...getMockProperties()]
        .sort((a, b) => b.id - a.id)
        .map((property) => {
          if (property.latitude === null || property.longitude === null)
            return {
              propertyId: property.id,
              propertyName: property.name,
              status: 'NO_LOCATION',
              commuteMinutes: null,
            };
          const minutes =
            Math.round(
              distanceMeters({ latitude, longitude }, { latitude: property.latitude, longitude: property.longitude }) /
                400,
            ) + 5;
          return minutes > COMMUTE_MAX_MINUTES
            ? { propertyId: property.id, propertyName: property.name, status: 'UNREACHABLE', commuteMinutes: null }
            : { propertyId: property.id, propertyName: property.name, status: 'REACHABLE', commuteMinutes: minutes };
        }),
    });
  }),
  http.get('*/api/properties', () =>
    success({
      totalCount: getMockProperties().length,
      items: [...getMockProperties()].sort((a, b) => b.id - a.id).map(propertyListItemResponse),
    }),
  ),
  // 서버는 UTF-8 BOM 을 붙인 text/csv 를 내려준다. BOM 이 없으면 엑셀에서 한글이 깨진다.
  http.get('*/api/properties/export.csv', () => {
    const rows = [...getMockProperties()]
      .sort((a, b) => b.id - a.id)
      .map((property) => {
        const photos = getMockPhotosByProperty().get(property.id) ?? [];
        const progress = propertyProgress(property.id);
        return [
          `"${property.name}"`,
          `"${property.address ?? ''}"`,
          property.depositAmount,
          property.monthlyRentAmount,
          photos.length,
          progress.completedCount,
          progress.totalCount,
          progress.progressRate,
        ].join(',');
      });
    const csv = ['이름,주소,보증금(만원),월세(만원),사진 수,체크 완료,체크 전체,진행률(%)', ...rows].join('\n');
    return new HttpResponse(new TextEncoder().encode(`\uFEFF${csv}\n`), {
      headers: { 'Content-Type': 'text/csv;charset=UTF-8' },
    });
  }),
  http.post('*/api/properties/export.pdf', async ({ request }) => {
    const body = (await request.json()) as { propertyIds?: number[] };
    if (!Array.isArray(body.propertyIds) || body.propertyIds.length < 2 || body.propertyIds.length > 5) {
      return failure('PROPERTY_INPUT_INVALID', 400);
    }
    return new HttpResponse(new TextEncoder().encode('%PDF-1.7\n% mock comparison\n%%EOF'), {
      headers: { 'Content-Type': 'application/pdf' },
    });
  }),
  http.post('*/api/properties/comparison-views', () => new HttpResponse(null, { status: 204 })),
  http.post('*/api/properties', async ({ request }) => {
    const body = (await request.json()) as PropertyWriteRequest;
    const id = Math.max(0, ...getMockProperties().map((property) => property.id)) + 1;
    const property = { id, ...propertyFromRequest(body) };
    setMockProperties([...getMockProperties(), property]);
    setMockPhotosByProperty(new Map(getMockPhotosByProperty()).set(id, []));
    return success(createPropertyResponse(property), 201);
  }),
  http.get('*/api/properties/:propertyId', ({ params }) => {
    const property = getProperty(params.propertyId);
    return property === undefined ? failure('PROPERTY_NOT_FOUND', 404) : success(propertyDetailResponse(property));
  }),
  http.put('*/api/properties/:propertyId', async ({ params, request }) => {
    const property = getProperty(params.propertyId);
    if (property === undefined) return failure('PROPERTY_NOT_FOUND', 404);
    const body = (await request.json()) as PropertyWriteRequest;
    const updated = { ...property, ...propertyFromRequest(body) };
    setMockProperties(getMockProperties().map((candidate) => (candidate.id === updated.id ? updated : candidate)));
    return success(updatePropertyResponse(updated));
  }),
  http.delete('*/api/properties/:propertyId', ({ params }) => {
    const property = getProperty(params.propertyId);
    if (property === undefined) return failure('PROPERTY_NOT_FOUND', 404);
    setMockProperties(getMockProperties().filter((candidate) => candidate.id !== property.id));
    return new HttpResponse(null, { status: 200 });
  }),
  http.get('*/api/properties/:propertyId/memo', ({ params }) => {
    const property = getProperty(params.propertyId);
    if (property === undefined) return failure('PROPERTY_NOT_FOUND', 404);
    const memo = getMockMemosByProperty().get(property.id);
    return memo === undefined ? failure('MEMO_NOT_FOUND', 404) : success(memo);
  }),
  http.put('*/api/properties/:propertyId/memo', async ({ params, request }) => {
    const property = getProperty(params.propertyId);
    if (property === undefined) return failure('PROPERTY_NOT_FOUND', 404);
    const body = (await request.json()) as { freeMemo?: string };
    const memo = { propertyId: property.id, freeMemo: body.freeMemo ?? '' };
    setMockMemosByProperty(new Map(getMockMemosByProperty()).set(property.id, memo));
    return success(memo);
  }),
  // 실제 서버는 이미지를 AI로 분석해 저장한다. 목은 이미지 수만 확인하고 정해 둔 추출 결과를 저장한다.
  http.post('*/api/properties/:propertyId/ai-import', async ({ params, request }) => {
    const property = getProperty(params.propertyId);
    if (property === undefined) return failure('PROPERTY_NOT_FOUND', 404);
    const imageCount = countImageParts(await request.text());
    if (imageCount === 0 || imageCount > 10) return failure('PROPERTY_AI_IMAGE_INVALID', 400);
    const updated = {
      ...property,
      depositAmount: 20_000_000,
      monthlyRentAmount: 650_000,
      maintenanceFeeAmount: 80_000,
    };
    setMockProperties(getMockProperties().map((candidate) => (candidate.id === updated.id ? updated : candidate)));
    const currentMemo = getMockMemosByProperty().get(property.id)?.freeMemo ?? '';
    const memo = {
      propertyId: property.id,
      freeMemo: currentMemo === '' ? '4층, 엘리베이터 있음' : `${currentMemo}\n\n4층, 엘리베이터 있음`,
    };
    setMockMemosByProperty(new Map(getMockMemosByProperty()).set(property.id, memo));
    return success({ property: updatePropertyResponse(updated), freeMemo: memo.freeMemo });
  }),
  http.get('*/api/properties/:propertyId/photos', ({ params }) => {
    const property = getProperty(params.propertyId);
    if (property === undefined) return failure('PROPERTY_NOT_FOUND', 404);
    const items = getMockPhotosByProperty().get(property.id) ?? [];
    return success({ propertyId: property.id, totalCount: items.length, items });
  }),
  http.post('*/api/properties/:propertyId/photos', notImplemented),
  http.delete('*/api/properties/:propertyId/photos/:photoId', ({ params }) => {
    const property = getProperty(params.propertyId);
    const photoId = readPositiveInteger(params.photoId);
    if (property === undefined || photoId === null) return failure('PHOTO_NOT_FOUND', 404);
    const current = getMockPhotosByProperty().get(property.id) ?? [];
    if (!current.some((photo) => photo.id === photoId)) return failure('PHOTO_NOT_FOUND', 404);
    const remaining = current.filter((photo) => photo.id !== photoId);
    if (remaining.length > 0 && !remaining.some((photo) => photo.representative)) {
      remaining[0] = { ...remaining[0], representative: true };
    }
    setMockPhotosByProperty(new Map(getMockPhotosByProperty()).set(property.id, remaining));
    return new HttpResponse(null, { status: 200 });
  }),
  http.put('*/api/properties/:propertyId/photos/:photoId/representative', ({ params }) => {
    const property = getProperty(params.propertyId);
    const photoId = readPositiveInteger(params.photoId);
    if (property === undefined || photoId === null) return failure('PHOTO_NOT_FOUND', 404);
    const current = getMockPhotosByProperty().get(property.id) ?? [];
    if (!current.some((photo) => photo.id === photoId)) return failure('PHOTO_NOT_FOUND', 404);
    const updated = current.map((photo) => ({ ...photo, representative: photo.id === photoId }));
    setMockPhotosByProperty(new Map(getMockPhotosByProperty()).set(property.id, updated));
    return new HttpResponse(null, { status: 200 });
  }),
  http.get('*/api/properties/:propertyId/photos/:photoId/content', obsoleteEndpoint),
  http.get('*/api/properties/:propertyId/photos/:photoId/thumbnail', ({ params }) => {
    const photoId = readPositiveInteger(params.photoId) ?? 81;
    return new HttpResponse(createMockPhotoBytes(photoId), { headers: { 'Content-Type': 'image/png' } });
  }),
  http.get('*/api/properties/:propertyId/photos/:photoId', ({ params }) => {
    const photoId = readPositiveInteger(params.photoId) ?? 81;
    return new HttpResponse(createMockPhotoBytes(photoId), { headers: { 'Content-Type': 'image/png' } });
  }),
];
