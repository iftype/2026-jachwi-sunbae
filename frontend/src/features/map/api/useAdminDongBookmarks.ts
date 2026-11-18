import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { usePublicConfig } from '@/shared/config/PublicConfigContext';

import { addAdminDongBookmark, fetchAdminDongBookmarks, removeAdminDongBookmark } from './adminDongBookmarkApi';

const BOOKMARKS_KEY = 'admin-dong-bookmarks';

/**
 * 내가 북마크한 행정동 코드와 추가, 해제.
 * 누르는 즉시 목록에 반영하고(낙관적 갱신), 서버가 실패하면 이전 목록으로 되돌린다.
 */
export const useAdminDongBookmarks = (enabled = true) => {
  const config = usePublicConfig();
  const client = useQueryClient();
  const key = [BOOKMARKS_KEY, config.apiBaseUrl];
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => fetchAdminDongBookmarks(config, signal),
    enabled,
    staleTime: 60 * 1000,
    retry: false,
  });
  const change = (next: (codes: string[]) => string[]) => {
    const previous = client.getQueryData<string[]>(key);
    client.setQueryData<string[]>(key, (codes) => next(codes ?? []));
    return previous;
  };
  const restore = (previous: string[] | undefined) => client.setQueryData(key, previous);
  const add = useMutation({
    mutationFn: (code: string) => addAdminDongBookmark(config, code),
    onMutate: (code) => change((codes) => (codes.includes(code) ? codes : [code, ...codes])),
    onError: (_error, _code, previous) => restore(previous),
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  });
  const remove = useMutation({
    mutationFn: (code: string) => removeAdminDongBookmark(config, code),
    onMutate: (code) => change((codes) => codes.filter((item) => item !== code)),
    onError: (_error, _code, previous) => restore(previous),
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  });
  const codes = query.data ?? [];
  return {
    codes,
    isLoading: query.isPending && enabled,
    isFailed: query.isError,
    isBookmarked: (code: string) => codes.includes(code),
    /** 북마크돼 있으면 해제하고, 아니면 추가한다. */
    toggle: (code: string) => (codes.includes(code) ? remove.mutate(code) : add.mutate(code)),
  };
};
