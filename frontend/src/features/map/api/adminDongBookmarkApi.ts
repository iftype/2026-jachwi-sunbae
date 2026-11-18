import { apiRequest } from '@/features/auth/api/apiClient';
import { readArray, readRecord, readString } from '@/shared/api/responseParsers';
import type { PublicConfig } from '@/shared/config/publicConfigTypes';

/** 내가 북마크한 행정동 코드 전체. 서버가 최근에 추가한 순서로 준다. */
export const fetchAdminDongBookmarks = (config: PublicConfig, signal?: AbortSignal): Promise<string[]> =>
  apiRequest({
    config,
    signal,
    path: '/api/admin-dong-bookmarks',
    parseData: (value) =>
      readArray(readRecord(value), 'adminDongCodes').map((code) => {
        if (typeof code !== 'string' || !/^\d{8}$/.test(code))
          throw new Error('북마크한 행정동 코드가 올바르지 않습니다.');
        return code;
      }),
  });

/** 이미 북마크한 동네를 다시 추가해도 서버가 같은 결과(201)로 답한다. */
export const addAdminDongBookmark = (config: PublicConfig, adminDongCode: string): Promise<string> =>
  apiRequest({
    config,
    path: '/api/admin-dong-bookmarks',
    method: 'POST',
    body: { adminDongCode },
    parseData: (value) => readString(readRecord(value), 'adminDongCode'),
  });

/** 북마크하지 않았거나 이미 해제한 동네는 서버가 404로 답한다. */
export const removeAdminDongBookmark = (config: PublicConfig, adminDongCode: string): Promise<void> =>
  apiRequest({
    config,
    path: `/api/admin-dong-bookmarks/${adminDongCode}`,
    method: 'DELETE',
    parseData: (value) => {
      if (value !== undefined) throw new Error('북마크 해제 응답이 올바르지 않습니다.');
    },
  });
