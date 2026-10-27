// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, it } from 'vitest';

import { setAuthentication } from '@/features/auth/model/authStore';
import { createStreetMemo, fetchStreetMemos, removeStreetMemo } from '@/features/street-memo/api/streetMemoApi';

import { server } from '../../../server';

const config = { apiBaseUrl: 'http://localhost:8080' };
const bounds = { south: 37.49, west: 127.02, north: 37.51, east: 127.04 };
const envelope = (data: unknown, status = 200) =>
  HttpResponse.json({ code: 'SUCCESS', message: '성공', data }, { status });
const memo = {
  streetMemoId: 7,
  latitude: 37.5,
  longitude: 127.03,
  memo: '  줄바꿈도\n그대로  ',
  preference: 'DISLIKE',
  isMine: true,
};

beforeEach(() => {
  setAuthentication({ accessToken: 'mock', tokenType: 'Bearer', expiresIn: 3600 });
});

it('지도 사각형 범위로 메모를 조회하고 입력한 공백·줄바꿈을 그대로 받는다', async () => {
  let requested: URL | null = null;
  server.use(
    http.get('*/api/street-memos', ({ request }) => {
      requested = new URL(request.url);
      return envelope([memo]);
    }),
  );
  await expect(fetchStreetMemos(config, bounds)).resolves.toEqual([
    { id: 7, latitude: 37.5, longitude: 127.03, memo: '  줄바꿈도\n그대로  ', preference: 'DISLIKE', isMine: true },
  ]);
  expect(Object.fromEntries(requested!.searchParams)).toEqual({
    minLatitude: '37.49',
    maxLatitude: '37.51',
    minLongitude: '127.02',
    maxLongitude: '127.04',
  });
});

it.each([
  ['정의되지 않은 선호', { ...memo, preference: 'NEUTRAL' }],
  ['좌표 누락', { ...memo, latitude: null }],
  ['본인 여부 누락', { ...memo, isMine: undefined }],
])('%s 응답은 받지 않는다', async (_, invalid) => {
  server.use(http.get('*/api/street-memos', () => envelope([invalid])));
  await expect(fetchStreetMemos(config, bounds)).rejects.toMatchObject({ kind: 'invalid-response' });
});

it('작성 요청은 위치·내용·선호를 보내고 저장된 메모를 받는다', async () => {
  let body: unknown = null;
  server.use(
    http.post('*/api/street-memos', async ({ request }) => {
      body = await request.json();
      return envelope(memo, 201);
    }),
  );
  const draft = { latitude: 37.5, longitude: 127.03, memo: '언덕', preference: 'LIKE' as const };
  await expect(createStreetMemo(config, draft)).resolves.toMatchObject({ id: 7 });
  expect(body).toEqual(draft);
});

it('삭제는 본문 없는 204를 성공으로, 404를 실패로 받는다', async () => {
  server.use(http.delete('*/api/street-memos/7', () => new HttpResponse(null, { status: 204 })));
  await expect(removeStreetMemo(config, 7)).resolves.toBeUndefined();
  server.use(
    http.delete('*/api/street-memos/8', () =>
      HttpResponse.json({ code: 'STREET_MEMO_NOT_FOUND', message: '없음', errors: [] }, { status: 404 }),
    ),
  );
  await expect(removeStreetMemo(config, 8)).rejects.toMatchObject({ status: 404 });
});
