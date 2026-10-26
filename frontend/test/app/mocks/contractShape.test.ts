// @vitest-environment node
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { handlers } from '@/app/mocks/handlers';

/**
 * 배포된 dev 백엔드(https://dev-api.jachwi-sunbae.kr/v3/api-docs)가 실제로 내려주는 필드 목록이다.
 * 목이 계약보다 넉넉해지면 화면이 없는 필드를 읽어도 목 뒤에서는 드러나지 않는다.
 * 그래서 "많아도 실패"하도록 키 집합을 정확히 비교한다. 계약이 바뀌면 이 표를 먼저 고친다.
 */
const CONTRACT = {
  BusStopsResponse: ['center', 'radius', 'count', 'busStops'],
  BusStopResponse: ['nodeId', 'name', 'latitude', 'longitude', 'distanceMeters'],
  NearbyResponse: ['center', 'radius', 'counts', 'places'],
  PropertyListItemResponse: [
    'id',
    'name',
    'depositAmount',
    'monthlyRentAmount',
    'discoverySource',
    'address',
    'latitude',
    'longitude',
    'photoCount',
    'representativePhoto',
    'overallProgress',
    'stages',
  ],
  CreatePropertyResponse: [
    'id',
    'name',
    'depositAmount',
    'monthlyRentAmount',
    'discoverySource',
    'address',
    'latitude',
    'longitude',
    'availableMoveInDate',
    'maintenanceFeeAmount',
    'visitScheduledAt',
    'roomOptions',
    'utilityOptions',
    'createdAt',
    'updatedAt',
    'photos',
    'overallProgress',
  ],
  PropertyDetailResponse: [
    'id',
    'name',
    'depositAmount',
    'monthlyRentAmount',
    'discoverySource',
    'address',
    'latitude',
    'longitude',
    'availableMoveInDate',
    'maintenanceFeeAmount',
    'visitScheduledAt',
    'roomOptions',
    'utilityOptions',
    'photoCount',
    'photos',
    'representativePhoto',
    'overallProgress',
    'createdAt',
    'updatedAt',
  ],
  UpdatePropertyResponse: [
    'id',
    'name',
    'depositAmount',
    'monthlyRentAmount',
    'discoverySource',
    'address',
    'latitude',
    'longitude',
    'availableMoveInDate',
    'maintenanceFeeAmount',
    'visitScheduledAt',
    'roomOptions',
    'utilityOptions',
    'updatedAt',
  ],
  PropertyDetailPhoto: ['id', 'url', 'contentType', 'sizeBytes', 'representative', 'createdAt'],
  PropertyRepresentativePhoto: ['id', 'url', 'contentType'],
  PropertyPhotoResponse: ['id', 'propertyId', 'url', 'contentType', 'sizeBytes', 'representative', 'createdAt'],
  PropertyChecklistStageResponse: [
    'stage',
    'applied',
    'propertyChecklistId',
    'checklistName',
    'sourceChecklistId',
    'progress',
  ],
  PropertyProgress: ['totalCount', 'completedCount', 'goodCount', 'cautionCount', 'unconfirmedCount', 'progressRate'],
  PropertyMemoResponse: ['propertyId', 'freeMemo'],
  MemberDetailResponse: ['id'],
  SystemCheckItemResponse: ['id', 'stage', 'itemType', 'question'],
  UserChecklistSummaryResponse: ['id', 'name', 'stage', 'itemCount'],
  UserChecklistItemResponse: ['id', 'systemCheckItemId', 'itemType', 'question', 'displayOrder', 'active'],
} as const;

const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const BASE = 'http://localhost:8080';

const readData = async (path: string, init?: RequestInit) => {
  const response = await fetch(BASE + path, init);
  const body = (await response.json()) as { data: unknown };
  return body.data;
};

const keysOf = (value: unknown) => Object.keys(value as Record<string, unknown>).sort();

const expectShape = (value: unknown, schema: keyof typeof CONTRACT) => {
  expect(value, `${schema} 응답이 객체가 아니다`).toBeTypeOf('object');
  expect(value).not.toBeNull();
  expect(keysOf(value), `${schema} 필드가 계약과 다르다`).toEqual([...CONTRACT[schema]].sort());
};

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

describe('목 응답은 배포된 dev 계약과 같은 필드를 내려준다', () => {
  it('지도 nearby 집계에서 교통은 빠지고 정류장은 전용 응답을 사용한다', async () => {
    const nearby = (await readData('/api/maps/nearby?latitude=37.5&longitude=127&radius=500')) as { counts: unknown };
    expectShape(nearby, 'NearbyResponse');
    expect(keysOf(nearby.counts)).toEqual(['HOSPITAL', 'SCHOOL', 'CONVENIENCE', 'AGENCY'].sort());
    const bus = (await readData('/api/maps/bus-stops?latitude=37.5&longitude=127&radius=500')) as {
      busStops: unknown[];
    };
    expectShape(bus, 'BusStopsResponse');
    bus.busStops.forEach((stop) => expectShape(stop, 'BusStopResponse'));
    expect((await fetch(BASE + '/api/maps/nearby?categories=TRANSPORT')).status).toBe(400);
    expect((await fetch(BASE + '/api/maps/bus-stops?latitude=37.5&longitude=127&radius=600')).status).toBe(400);
  });
  it('GET /api/properties', async () => {
    const data = (await readData('/api/properties')) as { items: Array<Record<string, unknown>> };
    // 사진과 적용된 체크리스트가 모두 있는 매물이라야 중첩 응답까지 확인할 수 있다.
    const item = data.items.find((candidate) => candidate.id === 10) as Record<string, unknown>;
    expectShape(item, 'PropertyListItemResponse');
    expectShape(item.overallProgress, 'PropertyProgress');
    expectShape((item.stages as unknown[])[0], 'PropertyChecklistStageResponse');
    expectShape(item.representativePhoto, 'PropertyRepresentativePhoto');
  });

  it('POST /api/properties', async () => {
    const data = await readData(
      '/api/properties',
      json({ name: '계약 검증 매물', depositAmount: 1_000_000, monthlyRentAmount: 500_000 }),
    );
    expectShape(data, 'CreatePropertyResponse');
    expectShape((data as { overallProgress: unknown }).overallProgress, 'PropertyProgress');
  });

  it('GET /api/properties/{id}', async () => {
    const data = (await readData('/api/properties/10')) as Record<string, unknown>;
    expectShape(data, 'PropertyDetailResponse');
    expectShape((data.photos as unknown[])[0], 'PropertyDetailPhoto');
    expectShape(data.representativePhoto, 'PropertyRepresentativePhoto');
  });

  it('PUT /api/properties/{id}', async () => {
    const response = await fetch(`${BASE}/api/properties/10`, {
      ...json({ name: '수정한 매물', depositAmount: 1_000_000, monthlyRentAmount: 500_000 }),
      method: 'PUT',
    });
    const body = (await response.json()) as { data: unknown };
    expectShape(body.data, 'UpdatePropertyResponse');
  });

  it('GET /api/properties/{id}/photos', async () => {
    const data = (await readData('/api/properties/10/photos')) as { items: unknown[] };
    expectShape(data.items[0], 'PropertyPhotoResponse');
  });

  it('GET /api/properties/{id}/memo', async () => {
    expectShape(await readData('/api/properties/10/memo'), 'PropertyMemoResponse');
  });

  it('GET /api/properties/{id}/checklists', async () => {
    const data = (await readData('/api/properties/10/checklists')) as Record<string, unknown>;
    expect(keysOf(data)).toEqual(['overallProgress', 'propertyId', 'stages']);
    expectShape(data.overallProgress, 'PropertyProgress');
    expectShape((data.stages as unknown[])[0], 'PropertyChecklistStageResponse');
  });

  it('GET /api/members/me', async () => {
    expectShape(await readData('/api/members/me'), 'MemberDetailResponse');
  });

  it('GET /api/check-items', async () => {
    const data = (await readData('/api/check-items?stage=ON_SITE')) as unknown[];
    expectShape(data[0], 'SystemCheckItemResponse');
  });

  it('GET /api/checklists', async () => {
    const data = (await readData('/api/checklists?stage=ON_SITE')) as { items: unknown[] };
    expectShape(data.items[0], 'UserChecklistSummaryResponse');
  });

  it('GET /api/checklists/{id}', async () => {
    const data = (await readData('/api/checklists/7')) as { items: unknown[] };
    expectShape(data.items[0], 'UserChecklistItemResponse');
  });

  it('GET /api/properties/export.csv 는 BOM 붙은 text/csv 를 내려준다', async () => {
    const response = await fetch(`${BASE}/api/properties/export.csv`);
    expect(response.headers.get('Content-Type')).toBe('text/csv;charset=UTF-8');
    // fetch 가 디코딩하며 BOM 을 떼어내므로 바이트로 확인한다.
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
    // TextDecoder 도 BOM 을 떼고 디코딩하므로 머리글만 비교한다.
    expect(new TextDecoder().decode(bytes).split('\n')[0]).toBe(
      '이름,주소,보증금(만원),월세(만원),사진 수,체크 완료,체크 전체,진행률(%)',
    );
  });
});
