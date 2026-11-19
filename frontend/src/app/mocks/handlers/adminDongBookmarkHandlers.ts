import { http, HttpResponse } from 'msw';

import { failure, readBookmarkedAdminDongs, success, writeBookmarkedAdminDongs } from '../mockStore';

const isAdminDongCode = (value: unknown): value is string => typeof value === 'string' && /^\d{8}$/.test(value);

/**
 * 행정동 북마크 API 목업. 추가는 멱등(이미 있어도 201)이고, 해제는 없는 코드면 404다.
 * 실제 API는 백엔드의 `docs/product/specs/admin-dong-bookmark.md`를 따른다.
 */
export const adminDongBookmarkHandlers = [
  http.get('*/api/admin-dong-bookmarks', () => success({ adminDongCodes: readBookmarkedAdminDongs() })),
  http.post('*/api/admin-dong-bookmarks', async ({ request }) => {
    const body: unknown = await request.json();
    const code = typeof body === 'object' && body !== null && 'adminDongCode' in body ? body.adminDongCode : undefined;
    if (!isAdminDongCode(code)) return failure('ADMIN_DONG_BOOKMARK_INVALID', 400);
    const current = readBookmarkedAdminDongs();
    if (!current.includes(code)) writeBookmarkedAdminDongs([code, ...current]);
    return success({ adminDongCode: code }, 201);
  }),
  http.delete('*/api/admin-dong-bookmarks/:adminDongCode', ({ params }) => {
    const code = params.adminDongCode;
    const current = readBookmarkedAdminDongs();
    if (typeof code !== 'string' || !current.includes(code)) return failure('ADMIN_DONG_BOOKMARK_NOT_FOUND', 404);
    writeBookmarkedAdminDongs(current.filter((item) => item !== code));
    return new HttpResponse(null, { status: 204 });
  }),
];
