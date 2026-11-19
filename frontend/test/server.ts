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
  // 내 기록 지도와 동네 찾기는 열 때 북마크한 동네를 조회한다. 기본은 북마크가 없는 상태다.
  http.get('*/api/admin-dong-bookmarks', () => success({ adminDongCodes: [] })),
  // 마이의 생활 날씨 카드는 열 때 수신 동의를 조회한다. 기본은 꺼짐이다.
  http.get('*/api/members/me/notification-settings', () => success({ enabled: false })),
  http.get('*/api/checklists', () => success({ totalCount: 0, items: [] })),
  // 동네 찾기에서 통근 시간이 나온 내 매물을 고르면 동선을 부른다. 기본은 정류장 하나를 타고 가는 동선이다.
  http.get('*/api/properties/:propertyId/commute-route', () =>
    success({
      totalMinutes: 20,
      transferCount: 0,
      legs: [
        {
          type: 'WALK',
          routeName: null,
          minutes: 3,
          waitMinutes: 0,
          points: [
            { stopId: null, name: '출발지', latitude: 37.5, longitude: 127.0 },
            { stopId: 'S1', name: '매물 앞 정류장', latitude: 37.501, longitude: 127.0 },
          ],
        },
        {
          type: 'BUS',
          routeName: '146',
          minutes: 15,
          waitMinutes: 2,
          points: [
            { stopId: 'S1', name: '매물 앞 정류장', latitude: 37.501, longitude: 127.0 },
            { stopId: null, name: '목적지', latitude: 37.55, longitude: 127.0 },
          ],
        },
      ],
    }),
  ),
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
    '*/api/properties/:propertyId/photos/:photoId/thumbnail',
    () => new HttpResponse(new Uint8Array([255, 216, 255]), { headers: { 'Content-Type': 'image/jpeg' } }),
  ),
  http.get(
    '*/api/properties/:propertyId/photos/:photoId',
    () => new HttpResponse(new Uint8Array([255, 216, 255]), { headers: { 'Content-Type': 'image/jpeg' } }),
  ),
);
