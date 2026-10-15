// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { errorEnvelope, photoFixture, successEnvelope } from '@/app/mocks/fixtures/propertyFixtures';
import { setAuthentication } from '@/features/auth/model/authStore';
import type { PropertyInputDto } from '@/features/property/api/dtos/PropertyDto';
import {
  fetchPropertyPhotoContent,
  fetchPropertyPhotos,
  removePropertyPhoto,
  setRepresentativePropertyPhoto,
  uploadPropertyPhoto,
} from '@/features/property/api/photoApi';
import {
  createProperty,
  fetchProperties,
  fetchPropertyDetail,
  fetchPropertyMemo,
  removeProperty,
  savePropertyMemoDocument,
  updateProperty,
} from '@/features/property/api/propertyApi';
import { getPropertyErrorMessage } from '@/features/property/api/propertyErrorMessages';
import type { PublicConfig } from '@/shared/config/publicConfigTypes';

import { server } from '../../../server';

const config: PublicConfig = {
  apiBaseUrl: 'http://localhost:8080',
};

const authenticate = () => setAuthentication({ accessToken: 'memory-token', tokenType: 'Bearer', expiresIn: 60 });

const propertyInput = {
  name: '신림역 원룸',
  depositAmount: 0,
  monthlyRentAmount: 550_000,
  discoverySource: 'https://example.com/home',
  address: '서울 관악구 신림로 12',
  latitude: 37.484,
  longitude: 126.929,
  availableMoveInDate: '2026-10-01',
  maintenanceFeeAmount: 70_000,
  visitScheduledAt: '2026-09-20T14:00:00',
  roomOptions: ['AIR_CONDITIONER', 'REFRIGERATOR'],
  utilityOptions: ['WATER', 'INTERNET'],
} satisfies PropertyInputDto;

const propertyAdditionalResponse = {
  availableMoveInDate: propertyInput.availableMoveInDate,
  maintenanceFeeAmount: propertyInput.maintenanceFeeAmount,
  visitScheduledAt: propertyInput.visitScheduledAt,
  roomOptions: [...propertyInput.roomOptions],
  utilityOptions: [...propertyInput.utilityOptions],
};

describe('FE-2 API 경계', () => {
  it('매물 목록은 서버에 검색·페이지 쿼리를 보내지 않고 클라이언트에서 이름을 검색한다', async () => {
    authenticate();
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.search).toBe('');
        expect(request.headers.get('Authorization')).toBe('Bearer memory-token');
        return HttpResponse.json(
          successEnvelope({
            totalCount: 2,
            items: [
              {
                id: 10,
                name: '신림역 원룸',
                depositAmount: 10_000_000,
                monthlyRentAmount: 550_000,
                discoverySource: 'https://example.com/listings/10',
                representativePhoto: null,
                overallProgress: {
                  totalCount: 0,
                  completedCount: 0,
                  goodCount: 0,
                  cautionCount: 0,
                  unconfirmedCount: 0,
                  progressRate: 0,
                },
                stages: [],
              },
              {
                id: 11,
                name: '망원동 투룸',
                depositAmount: 20_000_000,
                monthlyRentAmount: 700_000,
                discoverySource: null,
                representativePhoto: null,
                overallProgress: {
                  totalCount: 0,
                  completedCount: 0,
                  goodCount: 0,
                  cautionCount: 0,
                  unconfirmedCount: 0,
                  progressRate: 0,
                },
                stages: [],
              },
            ],
          }),
        );
      }),
    );

    const result = await fetchProperties(config, { query: '  신림  ', page: 2 });
    expect(result.content[0]?.name).toBe('신림역 원룸');
  });

  it('매물 생성은 Swagger에 정의된 필드만 보내고 서버의 URL 분류를 사용한다', async () => {
    authenticate();
    let requestBody: unknown;
    server.use(
      http.post(`${config.apiBaseUrl}/api/properties`, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(
          successEnvelope({
            id: 10,
            ...propertyInput,
            photos: [],
            createdAt: '2026-09-16T00:00:00Z',
            updatedAt: '2026-09-16T00:00:00Z',
            overallProgress: {
              totalCount: 0,
              completedCount: 0,
              goodCount: 0,
              cautionCount: 0,
              unconfirmedCount: 0,
              progressRate: 0,
            },
          }),
          { status: 201 },
        );
      }),
    );

    const result = await createProperty(config, propertyInput);

    expect(requestBody).toEqual(propertyInput);
    expect(result.discoverySource.type).toBe('URL');
    expect(result.roomOptions).toEqual(['AIR_CONDITIONER', 'REFRIGERATOR']);
  });

  it('매물 상세 응답의 기본 정보·사진·전체 진행률을 읽는다', async () => {
    authenticate();
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10`, () =>
        HttpResponse.json(
          successEnvelope({
            id: 10,
            name: '신림역 원룸',
            depositAmount: 10_000_000,
            monthlyRentAmount: 550_000,
            discoverySource: 'https://example.com/listings/10',
            address: '서울 관악구 신림로 12',
            latitude: 37.484,
            longitude: 126.929,
            ...propertyAdditionalResponse,
            photos: [{ id: 81, url: '/api/properties/10/photos/81', createdAt: '2026-08-10T07:35:00Z' }],
            createdAt: '2026-08-10T07:30:00Z',
            updatedAt: '2026-08-10T07:40:00Z',
            overallProgress: {
              totalCount: 3,
              completedCount: 2,
              goodCount: 1,
              cautionCount: 1,
              unconfirmedCount: 1,
              progressRate: 67,
            },
          }),
        ),
      ),
    );

    const detail = await fetchPropertyDetail(config, 10);
    expect(detail).toMatchObject({
      propertyId: 10,
      location: { address: '서울 관악구 신림로 12' },
      maintenanceFeeAmount: 70_000,
      photoPreview: { totalCount: 1, photos: [{ photoId: 81 }] },
    });
  });

  it('새 매물 상세 필드가 빠진 구버전 응답은 거부한다', async () => {
    authenticate();
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10`, () =>
        HttpResponse.json(
          successEnvelope({
            id: 10,
            name: '기존 매물',
            depositAmount: 10_000_000,
            monthlyRentAmount: 550_000,
            discoverySource: null,
            overallProgress: {
              totalCount: 0,
              completedCount: 0,
              goodCount: 0,
              cautionCount: 0,
              unconfirmedCount: 0,
              progressRate: 0,
            },
          }),
        ),
      ),
    );

    await expect(fetchPropertyDetail(config, 10)).rejects.toMatchObject({ kind: 'invalid-response' });
  });

  it('매물 상세의 선택 데이터가 비어 있거나 일부 사진이 잘못되어도 기본 정보를 읽는다', async () => {
    authenticate();
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10`, () =>
        HttpResponse.json(
          successEnvelope({
            id: 10,
            name: '기존 매물',
            depositAmount: 10_000_000,
            monthlyRentAmount: 550_000,
            discoverySource: undefined,
            address: null,
            latitude: null,
            longitude: null,
            availableMoveInDate: null,
            maintenanceFeeAmount: null,
            visitScheduledAt: null,
            roomOptions: [],
            utilityOptions: [],
            photos: [
              { id: 81, url: '/api/properties/10/photos/81' },
              { id: null, url: null },
            ],
          }),
        ),
      ),
    );

    await expect(fetchPropertyDetail(config, 10)).resolves.toMatchObject({
      propertyId: 10,
      name: '기존 매물',
      photoPreview: { totalCount: 1, photos: [{ photoId: 81 }] },
    });
  });

  it('매물 수정은 Swagger에 정의된 전체 필드와 선택 필드의 null을 보낸다', async () => {
    authenticate();
    let requestBody: unknown;
    server.use(
      http.put(`${config.apiBaseUrl}/api/properties/10`, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(
          successEnvelope({
            id: 10,
            name: '신림역 원룸',
            depositAmount: 10_000_000,
            monthlyRentAmount: 530_000,
            discoverySource: null,
            address: null,
            latitude: null,
            longitude: null,
            availableMoveInDate: null,
            maintenanceFeeAmount: null,
            visitScheduledAt: null,
            roomOptions: [],
            utilityOptions: [],
          }),
        );
      }),
    );

    const updateRequest = {
      name: '신림역 원룸',
      depositAmount: 10_000_000,
      monthlyRentAmount: 530_000,
      discoverySource: null,
      address: null,
      latitude: null,
      longitude: null,
      availableMoveInDate: null,
      maintenanceFeeAmount: null,
      visitScheduledAt: null,
      roomOptions: [],
      utilityOptions: [],
    };
    await updateProperty(config, 10, updateRequest);
    expect(requestBody).toEqual(updateRequest);
  });

  it('매물과 사진 삭제의 200 빈 응답을 JSON으로 파싱하지 않는다', async () => {
    authenticate();
    server.use(
      http.delete(`${config.apiBaseUrl}/api/properties/10`, () => new HttpResponse(null, { status: 200 })),
      http.delete(`${config.apiBaseUrl}/api/properties/10/photos/81`, () => new HttpResponse(null, { status: 200 })),
    );

    await expect(removeProperty(config, 10)).resolves.toBeUndefined();
    await expect(removePropertyPhoto(config, 10, 81)).resolves.toBeUndefined();
  });

  it('매물 메모는 자유 메모만 조회하고 저장한다', async () => {
    authenticate();
    let requestBody: unknown;
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10/memo`, () =>
        HttpResponse.json(
          successEnvelope({
            propertyId: 10,
            freeMemo: '',
          }),
        ),
      ),
      http.put(`${config.apiBaseUrl}/api/properties/10/memo`, async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(
          successEnvelope({
            propertyId: 10,
            freeMemo: '채광 확인',
          }),
        );
      }),
    );

    await expect(fetchPropertyMemo(config, 10)).resolves.toEqual({ propertyId: 10, freeMemo: '' });
    const memo = await savePropertyMemoDocument(config, 10, {
      freeMemo: '채광 확인',
    });
    expect(requestBody).toEqual({ freeMemo: '채광 확인' });
    expect(memo.freeMemo).toBe('채광 확인');
  });

  it('구조화 메모 응답 없이 빈 자유 메모를 그대로 사용한다', async () => {
    authenticate();
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10/memo`, () =>
        HttpResponse.json(successEnvelope({ propertyId: 10, freeMemo: '' })),
      ),
    );

    await expect(fetchPropertyMemo(config, 10)).resolves.toEqual({ propertyId: 10, freeMemo: '' });
  });

  it('사진 조회는 사용하되 미구현 업로드는 실패를 그대로 드러낸다', async () => {
    authenticate();
    let formEntries: string[] = [];
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10/photos`, () =>
        HttpResponse.json(successEnvelope({ propertyId: 10, items: [photoFixture], totalCount: 1 })),
      ),
      http.post(`${config.apiBaseUrl}/api/properties/10/photos`, async ({ request }) => {
        expect(request.headers.get('Content-Type')).toContain('multipart/form-data; boundary=');
        const formData = await request.formData();
        formEntries = [...formData.keys()];
        expect(formData.get('file')).toMatchObject({ type: 'image/jpeg', size: expect.any(Number) });
        return HttpResponse.json(errorEnvelope('NOT_IMPLEMENTED'), { status: 501 });
      }),
    );

    await expect(fetchPropertyPhotos(config, 10)).resolves.toMatchObject({ totalCount: 1 });
    const file = new File([new Uint8Array([1, 2, 3])], 'local-only.jpg', { type: 'image/jpeg' });
    await expect(uploadPropertyPhoto(config, 10, file)).rejects.toMatchObject({ status: 501, code: 'NOT_IMPLEMENTED' });
    expect(formEntries).toEqual(['file']);
  });

  it('API-203은 Bearer 헤더로 Blob을 읽고 contentUrl이나 query에 토큰을 넣지 않는다', async () => {
    authenticate();
    let requestedUrl = '';
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10/photos/81`, ({ request }) => {
        requestedUrl = request.url;
        expect(request.headers.get('Authorization')).toBe('Bearer memory-token');
        return new HttpResponse(new Uint8Array([255, 216, 255]), { headers: { 'Content-Type': 'image/jpeg' } });
      }),
    );

    const blob = await fetchPropertyPhotoContent(config, '/api/properties/10/photos/81');
    expect(blob.type).toBe('image/jpeg');
    expect(requestedUrl).toBe('http://localhost:8080/api/properties/10/photos/81');
    expect(requestedUrl).not.toContain('memory-token');
  });

  it('대표 사진 지정은 사진 식별자와 Bearer 헤더를 사용한다', async () => {
    authenticate();
    let requestedUrl = '';
    server.use(
      http.put(`${config.apiBaseUrl}/api/properties/10/photos/81/representative`, ({ request }) => {
        requestedUrl = request.url;
        expect(request.headers.get('Authorization')).toBe('Bearer memory-token');
        return new HttpResponse(null, { status: 200 });
      }),
    );

    await expect(setRepresentativePropertyPhoto(config, 10, 81)).resolves.toBeUndefined();
    expect(requestedUrl).toBe('http://localhost:8080/api/properties/10/photos/81/representative');
  });

  it('공통 오류 code를 서버 message 대신 안전한 사용자 문구로 매핑한다', async () => {
    authenticate();
    server.use(
      http.get(`${config.apiBaseUrl}/api/properties/10/photos`, () =>
        HttpResponse.json(errorEnvelope('PHOTO_READ_FAILED'), { status: 500 }),
      ),
    );

    const error = await fetchPropertyPhotos(config, 10).catch((caught: unknown) => caught);
    expect(getPropertyErrorMessage(error)).toBe('사진을 불러오지 못했습니다. 다시 시도해 주세요.');
    expect(getPropertyErrorMessage(error)).not.toContain('서버 내부 상세 메시지');
  });
});
