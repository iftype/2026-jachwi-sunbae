// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { beforeEach, expect, it } from 'vitest';

import { adminDongBookmarkHandlers } from '@/app/mocks/handlers/adminDongBookmarkHandlers';
import { resetMockStore } from '@/app/mocks/mockStore';
import { setAuthentication } from '@/features/auth/model/authStore';
import {
  addAdminDongBookmark,
  fetchAdminDongBookmarks,
  removeAdminDongBookmark,
} from '@/features/map/api/adminDongBookmarkApi';

import { server } from '../../../server';

const config = { apiBaseUrl: 'http://localhost:8080' };

beforeEach(() => {
  resetMockStore();
  server.use(...adminDongBookmarkHandlers);
  setAuthentication({ accessToken: 'valid-token', tokenType: 'Bearer', expiresIn: 60 });
});

it('북마크가 없으면 빈 목록이고, 추가하면 최근에 추가한 순서로 돌려준다', async () => {
  await expect(fetchAdminDongBookmarks(config)).resolves.toEqual([]);
  await addAdminDongBookmark(config, '11230640');
  await addAdminDongBookmark(config, '11140550');
  await expect(fetchAdminDongBookmarks(config)).resolves.toEqual(['11140550', '11230640']);
});

it('같은 동네를 다시 추가해도 하나로 유지한다', async () => {
  await expect(addAdminDongBookmark(config, '11230640')).resolves.toBe('11230640');
  await expect(addAdminDongBookmark(config, '11230640')).resolves.toBe('11230640');
  await expect(fetchAdminDongBookmarks(config)).resolves.toEqual(['11230640']);
});

it('해제하면 목록에서 빠지고, 이미 해제한 동네를 또 해제하면 실패한다', async () => {
  await addAdminDongBookmark(config, '11230640');
  await expect(removeAdminDongBookmark(config, '11230640')).resolves.toBeUndefined();
  await expect(fetchAdminDongBookmarks(config)).resolves.toEqual([]);
  await expect(removeAdminDongBookmark(config, '11230640')).rejects.toThrow();
});

it('형식이 틀린 코드를 보내면 서버가 거절하고, 형식이 틀린 응답은 받아들이지 않는다', async () => {
  await expect(addAdminDongBookmark(config, 'abc')).rejects.toThrow();
  server.use(
    http.get('*/api/admin-dong-bookmarks', () =>
      HttpResponse.json({ code: 'SUCCESS', message: '성공', data: { adminDongCodes: ['not-a-code'] } }),
    ),
  );
  await expect(fetchAdminDongBookmarks(config)).rejects.toThrow();
});
