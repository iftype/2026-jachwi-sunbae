import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { MapBounds } from '@/features/map/model/Map';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';

import type { StreetMemoDraft } from '../model/StreetMemo';
import { createStreetMemo, fetchStreetMemos, removeStreetMemo } from './streetMemoApi';

const STREET_MEMOS_KEY = 'street-memos';

/** 좌표를 소수점 5자리(약 1m)로 맞춰 같은 화면을 다시 볼 때 같은 요청이 되게 한다. */
const round = (value: number) => Math.round(value * 100_000) / 100_000;

/** 지도 화면 안의 거리 메모를 조회한다. bounds가 없으면(꺼져 있거나 아직 지도가 준비되지 않으면) 조회하지 않는다. */
export const useStreetMemos = (bounds: MapBounds | null) => {
  const config = usePublicConfig();
  const query = useMemo(
    () =>
      bounds && {
        south: round(bounds.south),
        west: round(bounds.west),
        north: round(bounds.north),
        east: round(bounds.east),
      },
    [bounds],
  );
  const memos = useQuery({
    queryKey: [STREET_MEMOS_KEY, config.apiBaseUrl, query?.south, query?.west, query?.north, query?.east],
    queryFn: ({ signal }) => fetchStreetMemos(config, query!, signal),
    enabled: query !== null,
    staleTime: 60 * 1000,
    retry: false,
    // 지도를 옮기는 동안 이전 화면의 메모를 남겨 마커가 깜빡이지 않게 한다.
    placeholderData: (previous) => previous,
  });
  return {
    memos: query === null ? [] : (memos.data ?? []),
    isFailed: memos.isError && !memos.isFetching,
    refetch: memos.refetch,
  };
};

/** 메모를 쓰거나 지우면 화면 범위와 상관없이 메모 조회를 모두 새로 받는다. */
export const useStreetMemoMutations = () => {
  const config = usePublicConfig();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: [STREET_MEMOS_KEY] });
  const create = useMutation({
    mutationFn: (draft: StreetMemoDraft) => createStreetMemo(config, draft),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (streetMemoId: number) => removeStreetMemo(config, streetMemoId),
    onSuccess: invalidate,
  });
  return { create, remove };
};
