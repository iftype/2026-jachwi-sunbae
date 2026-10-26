// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { errorEnvelope, successEnvelope } from '@/app/mocks/fixtures/propertyFixtures';
import { setAuthentication } from '@/features/auth/model/authStore';
import {
  assignActiveChecklist,
  createChecklistV11,
  fetchCheckItems,
  fetchChecklistDetail,
  fetchChecklistPreset,
  fetchChecklists,
  removeChecklist,
  updateChecklistV11,
} from '@/features/checklist/api/checklistApi';
import { getChecklistErrorMessage } from '@/features/checklist/api/checklistErrorMessages';
import type { PublicConfig } from '@/shared/config/publicConfigTypes';

import { server } from '../../../server';

const config: PublicConfig = {
  apiBaseUrl: 'http://localhost:8080',
};

const authenticate = () => setAuthentication({ accessToken: 'memory-token', tokenType: 'Bearer', expiresIn: 60 });

const checkItemsResponse = [
  { id: 101, stage: 'ON_SITE', itemType: 'CORE', question: '관리비를 확인했나요?' },
  { id: 102, stage: 'ON_SITE', itemType: 'OPTIONAL', question: '입주일을 확인했나요?' },
];

const checklistDetailResponse = {
  id: 7,
  name: '전화 문의 기본 목록',
  stage: 'ON_SITE',
  itemCount: 2,
  items: [
    {
      id: 701,
      systemCheckItemId: 101,
      itemType: 'CORE',
      question: '관리비를 확인했나요?',
      displayOrder: 1,
      active: true,
    },
    {
      id: 702,
      systemCheckItemId: 102,
      itemType: 'OPTIONAL',
      question: '입주일을 확인했나요?',
      displayOrder: 2,
      active: true,
    },
  ],
};

describe('최종 체크리스트 API 계약', () => {
  it('시스템 체크 항목은 stage와 trim한 query만 보내며 회원 인증으로 조회한다', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/api/check-items`, ({ request }) => {
        const url = new URL(request.url);
        expect(Object.fromEntries(url.searchParams)).toEqual({ stage: 'ON_SITE', query: '관리비' });
        expect(request.headers.get('Authorization')).toMatch(/^Bearer /);
        return HttpResponse.json(successEnvelope([checkItemsResponse[0]]));
      }),
    );

    await expect(fetchCheckItems(config, { stage: 'ON_SITE', query: '  관리비  ', page: 3 })).resolves.toMatchObject({
      content: [{ checkItemId: 101, itemType: 'CORE' }],
      hasNext: false,
    });
  });

  it('삭제된 프리셋 API 대신 시스템 체크 항목의 CORE만 화면 시작 구성으로 만든다', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/api/check-items`, () => HttpResponse.json(successEnvelope(checkItemsResponse))),
    );

    const result = await fetchChecklistPreset(config, 'ON_SITE', 'ONE_ROOM');
    expect(result.items).toMatchObject([{ checkItemId: 101, itemType: 'CORE', order: 0 }]);
  });

  it('체크리스트 목록의 items와 totalCount를 읽는다', async () => {
    authenticate();
    server.use(
      http.get(`${config.apiBaseUrl}/api/checklists`, ({ request }) => {
        expect(new URL(request.url).searchParams.toString()).toBe('stage=ON_SITE');
        return HttpResponse.json(
          successEnvelope({
            totalCount: 1,
            items: [{ id: 7, name: '전화 문의 기본 목록', stage: 'ON_SITE', itemCount: 2 }],
          }),
        );
      }),
    );

    await expect(fetchChecklists(config, { stage: 'ON_SITE' })).resolves.toMatchObject({
      content: [{ checklistId: 7 }],
      totalElements: 1,
    });
  });

  it('생성 시 제공 항목을 최종 순서대로 전송한다', async () => {
    authenticate();
    let body: unknown;
    server.use(
      http.post(`${config.apiBaseUrl}/api/checklists`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(successEnvelope(checklistDetailResponse), { status: 201 });
      }),
    );

    await createChecklistV11(config, {
      name: '전화 문의 기본 목록',
      stage: 'ON_SITE',
      items: [{ systemCheckItemId: 101 }],
    });
    expect(body).toEqual({
      name: '전화 문의 기본 목록',
      stage: 'ON_SITE',
      items: [{ systemCheckItemId: 101 }],
    });
  });

  it('상세 조회와 전체 교체 응답에서 itemType·active·displayOrder를 보존한다', async () => {
    authenticate();
    let body: unknown;
    server.use(
      http.get(`${config.apiBaseUrl}/api/checklists/7`, () =>
        HttpResponse.json(successEnvelope(checklistDetailResponse)),
      ),
      http.put(`${config.apiBaseUrl}/api/checklists/7`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(successEnvelope(checklistDetailResponse));
      }),
    );

    await expect(fetchChecklistDetail(config, 7)).resolves.toMatchObject({
      items: [
        { sourceCheckItemId: 101, itemType: 'CORE', active: true, order: 1 },
        { sourceCheckItemId: 102, itemType: 'OPTIONAL', active: true, order: 2 },
      ],
    });
    await updateChecklistV11(config, 7, {
      name: '전화 문의 기본 목록',
      items: [{ systemCheckItemId: 101 }, { systemCheckItemId: 102 }],
    });
    expect(body).toEqual({
      name: '전화 문의 기본 목록',
      items: [{ systemCheckItemId: 101 }, { systemCheckItemId: 102 }],
    });
  });

  it('체크리스트 삭제는 200 빈 본문을 읽지 않는다', async () => {
    authenticate();
    server.use(http.delete(`${config.apiBaseUrl}/api/checklists/7`, () => new HttpResponse(null, { status: 200 })));

    await expect(removeChecklist(config, 7)).resolves.toBeUndefined();
  });

  it('매물 체크리스트 적용은 최종 경로와 응답 계약을 사용한다', async () => {
    authenticate();
    let body: unknown;
    server.use(
      http.put(`${config.apiBaseUrl}/api/properties/10/checklists/ON_SITE`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          successEnvelope({
            id: 31,
            propertyId: 10,
            sourceChecklistId: 7,
            checklistName: '전화 문의 기본 목록',
            stage: 'ON_SITE',
            items: [
              {
                id: 501,
                systemCheckItemId: 101,
                question: '관리비를 확인했나요?',
                displayOrder: 1,
                status: 'UNCONFIRMED',
                memo: '',
              },
            ],
          }),
        );
      }),
    );

    await expect(assignActiveChecklist(config, 10, 'ON_SITE', { checklistId: 7 })).resolves.toMatchObject({
      propertyChecklistId: 31,
      propertyId: 10,
      checklistId: 7,
      itemCount: 1,
    });
    expect(body).toEqual({ sourceType: 'USER', checklistId: 7 });
  });

  it('서버 오류 코드는 안전한 사용자 문구로 매핑한다', async () => {
    authenticate();
    server.use(
      http.get(`${config.apiBaseUrl}/api/checklists/7`, () =>
        HttpResponse.json(errorEnvelope('CHECK_ITEM_INACTIVE'), { status: 400 }),
      ),
    );
    const error = await fetchChecklistDetail(config, 7).catch((caught: unknown) => caught);
    expect(getChecklistErrorMessage(error)).toContain('더 이상 제공되지 않는 항목');
  });
});
