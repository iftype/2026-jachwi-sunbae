import type { QueryClient } from '@tanstack/react-query';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { usePublicConfig } from '@/shared/config/PublicConfigContext';
import type { PublicConfig } from '@/shared/config/publicConfigTypes';

import type { CommuteArea, CommuteResult } from './commuteApi';
import { fetchCommuteAreas } from './commuteApi';

/** 동 하나의 월세 시세(최근 6개월 실거래 중앙값, 원 단위). */
export type RegionRent = { monthlyRentKrw: number; depositKrw: number; transactionCount: number };
/**
 * 행정동 코드별 월세 시세. 값이 null이면 거래가 적어(5건 미만) 서버가 시세를 내지 않은 동이다.
 * 표에 없는 코드는 아직 받는 중이거나, 받지 못했거나, 응답 범위(수도권) 밖이라 모르는 동이다.
 */
export type RegionRentTable = Readonly<Record<string, RegionRent | null>>;

type Point = { latitude: number; longitude: number };

/**
 * 동별 시세는 통근 결과 API에만 실려 온다. 시세는 기준 좌표와 무관한 고정 값이라, 고정 좌표에서 가장 넓게(60분, 환승 2회)
 * 한 번 받아 표로 줄여 두고 여러 화면이 같은 키로 나눠 쓴다. 서울시청에서 받으면 수도권 660개 동 중 627개가 온다.
 * 응답이 약 1.7MB라 찜한 동네가 있을 때만 받는다. 백엔드가 북마크 응답에 시세를 합쳐 주면 이 훅의 조회만 바꾸면 된다.
 */
export const PRIMARY_RENT_CENTER: Point = { latitude: 37.5665, longitude: 126.978 };
/** 첫 응답에 없는 찜한 동이 있을 때만 한 번 더 받는 다른 중심(선릉역). */
export const FALLBACK_RENT_CENTER: Point = { latitude: 37.5045, longitude: 127.049 };
const RENT_MAX_MINUTES = 60;
const RENT_MAX_TRANSFERS = 2;
/** 시세는 서버가 다시 적재할 때만 바뀐다. */
const RENT_STALE_MS = 6 * 60 * 60 * 1000;
const RENT_GC_MS = 12 * 60 * 60 * 1000;
const EMPTY: RegionRentTable = {};

export const rentTableQueryKey = (apiBaseUrl: string, center: Point) =>
  ['commute-rents-all', apiBaseUrl, center.latitude, center.longitude] as const;

/** 통근 결과의 동 목록을 시세 표로 줄인다. 경계와 정류장 같은 큰 값은 버린다. */
export const toRentTable = (areas: readonly CommuteArea[]): RegionRentTable =>
  Object.fromEntries(
    areas.map((area) => [
      area.adminDongCode,
      area.rent
        ? {
            monthlyRentKrw: area.rent.monthlyRentKrw,
            depositKrw: area.rent.depositKrw,
            transactionCount: area.rent.transactionCount,
          }
        : null,
    ]),
  );

/** 표에서 고른 코드만 남긴다. 표에 없는 코드는 넣지 않는다. */
export const pickRents = (table: RegionRentTable, codes: readonly string[]): RegionRentTable =>
  Object.fromEntries(codes.filter((code) => code in table).map((code) => [code, table[code]]));

/** 표에서 아직 찾지 못한 코드. */
export const missingCodes = (codes: readonly string[], table: RegionRentTable): string[] =>
  codes.filter((code) => !(code in table));

/** 동네 찾기가 이미 받아 둔 통근 결과(`commute-areas`)의 시세를 모은다. 같은 동의 시세는 어느 결과든 같다. */
export const rentsFromCachedResults = (client: QueryClient, apiBaseUrl: string): RegionRentTable =>
  client
    .getQueriesData<CommuteResult>({ queryKey: ['commute-areas', apiBaseUrl] })
    .reduce<Record<string, RegionRent | null>>(
      (all, [, result]) => (result ? Object.assign(all, toRentTable(result.areas)) : all),
      {},
    );

const rentTableQuery = (config: PublicConfig, center: Point) => ({
  queryKey: rentTableQueryKey(config.apiBaseUrl, center),
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    fetchCommuteAreas(config, center, RENT_MAX_MINUTES, RENT_MAX_TRANSFERS, signal).then((result) =>
      toRentTable(result.areas),
    ),
  staleTime: RENT_STALE_MS,
  gcTime: RENT_GC_MS,
  retry: false,
});

/**
 * 찜한 동네의 월세 시세. 찜이 없거나 꺼 두면 받지 않는다.
 * 동네 찾기 결과가 캐시에 있으면 그 시세부터 쓰고, 모자란 동만 고정 좌표로 받는다. 첫 응답에도 없는 동이 있으면 한 번 더 받는다.
 * 받는 중이거나 실패하면 그 동은 표에 없어, 화면은 월세 표시만 빼고 영역과 찜 해제는 그대로 둔다.
 */
export const useBookmarkedRegionRents = (codes: readonly string[], enabled: boolean): RegionRentTable => {
  const config = usePublicConfig();
  const client = useQueryClient();
  const key = codes.join(',');
  // codes는 렌더마다 새 배열일 수 있어, 문자열 키로 바뀔 때만 새 목록을 만든다.
  const list = useMemo(() => (key === '' ? [] : key.split(',')), [key]);
  const isOn = enabled && list.length > 0;
  const cached = useMemo(
    () => (isOn ? pickRents(rentsFromCachedResults(client, config.apiBaseUrl), list) : EMPTY),
    [client, config.apiBaseUrl, isOn, list],
  );
  // 응답 전체(동 수백 개)는 캐시에 표로 두고, 화면에는 찜한 동만 골라 넘긴다.
  const select = useCallback((table: RegionRentTable) => pickRents(table, list), [list]);
  const needsPrimary = isOn && missingCodes(list, cached).length > 0;
  const primary = useQuery({ ...rentTableQuery(config, PRIMARY_RENT_CENTER), enabled: needsPrimary, select });
  // 첫 응답을 받은 뒤에도 모자란 동이 있을 때만 더 받는다. 받는 중이거나 실패했으면 더 받지 않는다.
  const needsFallback =
    needsPrimary && primary.isSuccess && missingCodes(list, { ...cached, ...primary.data }).length > 0;
  const fallback = useQuery({ ...rentTableQuery(config, FALLBACK_RENT_CENTER), enabled: needsFallback, select });
  const primaryData = needsPrimary ? primary.data : undefined;
  const fallbackData = needsFallback ? fallback.data : undefined;
  return useMemo(
    () => (isOn ? { ...fallbackData, ...primaryData, ...cached } : EMPTY),
    [isOn, cached, primaryData, fallbackData],
  );
};
