import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { beforeEach, expect, it } from 'vitest';

import { adminDongBookmarkHandlers } from '@/app/mocks/handlers/adminDongBookmarkHandlers';
import { resetMockStore } from '@/app/mocks/mockStore';
import { setAuthentication } from '@/features/auth/model/authStore';
import { useAdminDongBookmarks } from '@/features/map/api/useAdminDongBookmarks';
import { PublicConfigProvider } from '@/shared/config/PublicConfigContext';

import { server } from '../../../server';

beforeEach(() => {
  resetMockStore();
  server.use(...adminDongBookmarkHandlers);
  setAuthentication({ accessToken: 'valid-token', tokenType: 'Bearer', expiresIn: 60 });
});

const setup = (enabled = true) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <PublicConfigProvider config={{ apiBaseUrl: 'http://localhost', commuteDataSource: 'mock' }}>
        {children}
      </PublicConfigProvider>
    </QueryClientProvider>
  );
  return renderHook(() => useAdminDongBookmarks(enabled), { wrapper });
};

it('북마크한 동네 코드를 받아 와서 있는지 알려 준다', async () => {
  server.use(
    http.get('*/api/admin-dong-bookmarks', () =>
      HttpResponse.json({ code: 'SUCCESS', message: '성공', data: { adminDongCodes: ['11230640'] } }),
    ),
  );
  const { result } = setup();
  await waitFor(() => expect(result.current.codes).toEqual(['11230640']));
  expect(result.current.isBookmarked('11230640')).toBe(true);
  expect(result.current.isBookmarked('11140550')).toBe(false);
});

it('토글하면 서버 응답을 기다리지 않고 목록에 반영하고, 한 번 더 누르면 해제한다', async () => {
  const { result } = setup();
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  act(() => result.current.toggle('11230640'));
  await waitFor(() => expect(result.current.codes).toEqual(['11230640']));
  act(() => result.current.toggle('11230640'));
  await waitFor(() => expect(result.current.codes).toEqual([]));
});

it('서버가 추가에 실패하면 이전 목록으로 되돌린다', async () => {
  server.use(
    http.post('*/api/admin-dong-bookmarks', () =>
      HttpResponse.json({ code: 'ERROR', message: '실패' }, { status: 500 }),
    ),
    http.get('*/api/admin-dong-bookmarks', () =>
      HttpResponse.json({ code: 'SUCCESS', message: '성공', data: { adminDongCodes: [] } }),
    ),
  );
  const { result } = setup();
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  act(() => result.current.toggle('11230640'));
  await waitFor(() => expect(result.current.codes).toEqual([]));
  expect(result.current.isBookmarked('11230640')).toBe(false);
});

it('꺼 둔 동안(공개 탐색)에는 목록을 부르지 않는다', async () => {
  let requested = false;
  server.use(
    http.get('*/api/admin-dong-bookmarks', () => {
      requested = true;
      return HttpResponse.json({ code: 'SUCCESS', message: '성공', data: { adminDongCodes: [] } });
    }),
  );
  const { result } = setup(false);
  expect(result.current.isLoading).toBe(false);
  expect(result.current.codes).toEqual([]);
  expect(requested).toBe(false);
});
