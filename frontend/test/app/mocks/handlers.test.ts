import { beforeEach, describe, expect, it } from 'vitest';

import { handlers } from '@/app/mocks/handlers';
import { resetMockStore } from '@/app/mocks/mockStore';

import { server } from '../../server';

const apiUrl = (path: string) => `http://localhost${path}`;

const readJson = async (response: Response) => response.json() as Promise<Record<string, unknown>>;

describe('최종 API 명세 MSW handlers', () => {
  beforeEach(() => {
    resetMockStore();
    server.use(...handlers);
  });

  it('인증 없이 단계별 시스템 체크 항목을 검색한다', async () => {
    const response = await fetch(apiUrl('/api/check-items?stage=ON_SITE&query=수압'));
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      code: 'SUCCESS',
      data: [{ id: 201, stage: 'ON_SITE', itemType: 'CORE', question: '수압이 충분한가요?' }],
    });
  });

  it('지도 시설 응답은 선택 좌표·반경·카테고리를 반영한다', async () => {
    const body = await readJson(
      await fetch(apiUrl('/api/maps/nearby?latitude=37.48&longitude=126.93&radius=500&categories=HOSPITAL')),
    );
    expect(body).toMatchObject({
      code: 'SUCCESS',
      data: {
        center: { latitude: 37.48, longitude: 126.93 },
        radius: 500,
        counts: { HOSPITAL: 5, TRANSPORT: 0, SCHOOL: 0, CONVENIENCE: 0, AGENCY: 0 },
      },
    });
    const data = body.data as { places: Array<{ category: string; distanceMeters: number; latitude: number }> };
    expect(data.places).toHaveLength(5);
    expect(data.places.every((place) => place.category === 'HOSPITAL' && place.distanceMeters <= 500)).toBe(true);
    expect(data.places.every((place) => Math.abs(place.latitude - 37.48) < 0.005)).toBe(true);
  });

  it('역지오코딩은 샘플 매물 주소와 선택 좌표를 일치시킨다', async () => {
    const body = await readJson(
      await fetch(apiUrl('/api/maps/reverse-geocode?latitude=37.4841234&longitude=126.9291234')),
    );
    expect(body).toMatchObject({
      data: { roadAddress: '서울 관악구 신림로 12길 3', latitude: 37.4841234, longitude: 126.9291234 },
    });
  });

  it('매물 목록은 dev 계약의 items·좌표·대표 사진 필드를 제공한다', async () => {
    const body = await readJson(await fetch(apiUrl('/api/properties')));
    expect(body).toMatchObject({
      data: {
        totalCount: 2,
        items: expect.arrayContaining([
          expect.objectContaining({
            id: 10,
            latitude: 37.4841234,
            longitude: 126.9291234,
            representativePhoto: expect.objectContaining({
              id: expect.any(Number),
              url: expect.any(String),
              contentType: 'image/png',
            }),
            stages: expect.any(Array),
            overallProgress: expect.any(Object),
          }),
        ]),
      },
    });
  });

  it('매물 메모는 자유 메모만 전체 교체한다', async () => {
    const response = await fetch(apiUrl('/api/properties/10/memo'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ freeMemo: '계약 전에 결로 자국 다시 보기' }),
    });
    const body = await readJson(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      code: 'SUCCESS',
      data: { propertyId: 10, freeMemo: '계약 전에 결로 자국 다시 보기' },
    });

    const reread = await readJson(await fetch(apiUrl('/api/properties/10/memo')));
    expect(reread.data).toEqual({ propertyId: 10, freeMemo: '계약 전에 결로 자국 다시 보기' });
  });

  it('사용자 직접 질문을 보낸 항목은 거절한다', async () => {
    const response = await fetch(apiUrl('/api/checklists'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '잘못된 체크리스트',
        stage: 'ON_SITE',
        items: [{ systemCheckItemId: null, question: '직접 질문' }],
      }),
    });
    const body = await readJson(response);

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ code: 'CHECKLIST_ITEMS_INVALID' });
  });

  it('체크리스트를 생성해 매물에 연결하고 상태와 메모를 자동 저장한다', async () => {
    const createResponse = await fetch(apiUrl('/api/checklists'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '현장 확인 목록',
        stage: 'ON_SITE',
        items: [{ systemCheckItemId: 201 }, { systemCheckItemId: 202 }, { systemCheckItemId: 203 }],
      }),
    });
    const createBody = await readJson(createResponse);
    const created = createBody.data as {
      id: number;
      itemCount: number;
      items: Array<{ systemCheckItemId: number | null }>;
    };

    expect(createResponse.status).toBe(201);
    expect(created).toMatchObject({ itemCount: 3 });
    expect(created.items.map((item) => item.systemCheckItemId)).toEqual([201, 202, 203]);

    const applyResponse = await fetch(apiUrl('/api/properties/10/checklists/ON_SITE'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checklistId: created.id }),
    });
    const applyBody = await readJson(applyResponse);
    const applied = applyBody.data as {
      id: number;
      propertyId: number;
      stage: string;
      items: Array<{ id: number; status: string; memo: string }>;
    };

    expect(applyResponse.status).toBe(200);
    expect(applied).toMatchObject({ propertyId: 10, stage: 'ON_SITE' });
    expect(applied.items).toHaveLength(3);
    expect(applied.items[0]).toMatchObject({ status: 'UNCONFIRMED', memo: '' });

    const itemId = applied.items[0]?.id;
    expect(itemId).toBeTypeOf('number');

    const statusResponse = await fetch(apiUrl(`/api/properties/10/checklists/${applied.id}/items/${itemId}/status`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'GOOD' }),
    });
    const memoResponse = await fetch(apiUrl(`/api/properties/10/checklists/${applied.id}/items/${itemId}/memo`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memo: '수압이 충분함' }),
    });

    expect(statusResponse.status).toBe(200);
    expect(memoResponse.status).toBe(200);

    const detailResponse = await fetch(apiUrl(`/api/properties/10/checklists/${applied.id}`));
    const detailBody = await readJson(detailResponse);
    const detail = detailBody.data as {
      items: Array<{ id: number; status: string; memo: string }>;
    };

    expect(detailResponse.status).toBe(200);
    expect(detail.items.find((item) => item.id === itemId)).toMatchObject({
      status: 'GOOD',
      memo: '수압이 충분함',
    });
  });

  it.each([
    ['POST', '/api/properties/10/photos', 501, 'NOT_IMPLEMENTED'],
    ['GET', '/api/checklist-presets', 410, 'API_CONTRACT_REMOVED'],
    ['GET', '/api/properties/10/active-checklists/ON_SITE', 410, 'API_CONTRACT_REMOVED'],
    ['GET', '/api/properties/10/photos/81/content', 410, 'API_CONTRACT_REMOVED'],
  ])('%s %s는 성공 응답으로 위장하지 않는다', async (method, path, status, code) => {
    const response = await fetch(apiUrl(path), { method });
    const body = await readJson(response);

    expect(response.status).toBe(status);
    expect(body).toMatchObject({ code });
  });
});
