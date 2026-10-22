import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const success = (data: unknown) => HttpResponse.json({ code: 'SUCCESS', message: '요청에 성공했습니다.', data });

const tokenResponse = () =>
  success({
    accessToken: 'test-auto-login-token',
    tokenType: 'Bearer',
    expiresIn: 900,
    newMember: false,
    member: { memberId: 1 },
  });

export const server = setupServer(
  http.post('*/api/auth/login', tokenResponse),
  http.post('*/api/auth/refresh', tokenResponse),
  http.get('*/api/members/me', () => success({ id: 1 })),
  http.get('*/api/checklists', () => success({ totalCount: 0, items: [] })),
  http.get('*/api/properties/:propertyId/memo', ({ params }) =>
    success({
      propertyId: Number(params.propertyId),
      freeMemo: '',
    }),
  ),
  http.get('*/api/properties/:propertyId/checklists', ({ params }) =>
    success({
      propertyId: Number(params.propertyId),
      overallProgress: {
        totalCount: 0,
        completedCount: 0,
        goodCount: 0,
        cautionCount: 0,
        unconfirmedCount: 0,
        progressRate: 0,
      },
      stages: ['ON_SITE', 'PRE_CONTRACT'].map((stage) => ({
        stage,
        applied: false,
        propertyChecklistId: null,
        checklistName: null,
        sourceChecklistId: null,
        progress: {
          totalCount: 0,
          completedCount: 0,
          goodCount: 0,
          cautionCount: 0,
          unconfirmedCount: 0,
          progressRate: 0,
        },
      })),
    }),
  ),
  // 상세 화면은 단계가 비어 있으면 제공 체크리스트를 자동으로 적용한다.
  http.put('*/api/properties/:propertyId/checklists/:stage', ({ params }) =>
    success({
      id: 51,
      propertyId: Number(params.propertyId),
      sourceChecklistId: null,
      checklistName: '제공 체크리스트',
      stage: params.stage,
      items: [],
    }),
  ),
  http.get(
    '*/api/properties/:propertyId/photos/:photoId',
    () => new HttpResponse(new Uint8Array([255, 216, 255]), { headers: { 'Content-Type': 'image/jpeg' } }),
  ),
);
