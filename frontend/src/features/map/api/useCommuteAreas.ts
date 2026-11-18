import type { QueryClient } from '@tanstack/react-query';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { usePublicConfig } from '@/shared/config/PublicConfigContext';
import type { PublicConfig } from '@/shared/config/publicConfigTypes';

import type { AdminBoundaries } from './adminBoundaryApi';
import { fetchBoundaryManifest, selectBoundaryFiles } from './adminBoundaryApi';
import { getAdminBoundaryQueryOptions } from './adminBoundaryQueries';
import { fetchCommuteAreas } from './commuteApi';

/** 동네 찾기 화면을 벗어난 뒤에도 통근 결과를 들고 있는 시간. */
const COMMUTE_RESULT_GC_MS = 30 * 60 * 1000;

type Options = {
  config: PublicConfig;
  destination: { latitude: number; longitude: number };
  maxMinutes: number;
  maxTransfers: number;
  enabled: boolean;
};

/**
 * 통근 결과와 manifest를 함께 받고, 결과 행정동이 속한 시도의 경계 파일만 받아 합친다.
 * 수도권 파일은 장소를 고르는 동안 `usePrefetchMetroBoundaries`가 같은 키로 미리 받아 두므로 대개 캐시에서 바로 꺼낸다.
 * 거래가 5건보다 적어 서버가 월세 시세를 비워 보낸 동네도 통근 조건에 맞으면 그린다(화면이 `월세 정보 없음`으로 표시한다).
 */
const loadResult = async (client: QueryClient, options: Options, signal: AbortSignal) => {
  const { config, destination, maxMinutes, maxTransfers } = options;
  const [result, manifest] = await Promise.all([
    fetchCommuteAreas(config, destination, maxMinutes, maxTransfers, signal),
    fetchBoundaryManifest(config.boundaryBaseUrl, signal),
  ]);
  signal.throwIfAborted();
  const chunks = await Promise.all(
    selectBoundaryFiles(
      manifest,
      result.areas.map((area) => area.adminDongCode),
    ).map((file) => client.ensureQueryData(getAdminBoundaryQueryOptions(file, config.boundaryBaseUrl))),
  );
  signal.throwIfAborted();
  const boundaries = chunks.reduce<AdminBoundaries>((all, chunk) => Object.assign(all, chunk), {});
  return {
    ...result,
    areaCount: result.areas.length,
    areas: result.areas.map((area) => ({
      ...area,
      name: boundaries[area.adminDongCode]?.name ?? area.adminDongCode,
      fullName: boundaries[area.adminDongCode]?.fullName ?? '경계 정보가 없는 동네',
      center: boundaries[area.adminDongCode]?.center ?? area.center,
      polygons: boundaries[area.adminDongCode]?.polygons ?? [],
      simplifiedPolygons: boundaries[area.adminDongCode]?.simplifiedPolygons,
    })),
  };
};

export const useCommuteAreas = (input: Omit<Options, 'config'>) => {
  const options = { ...input, config: usePublicConfig() };
  const client = useQueryClient();
  const { config, destination, maxMinutes, maxTransfers, enabled } = options;
  return useQuery({
    queryKey: [
      'commute-areas',
      config.apiBaseUrl,
      config.boundaryBaseUrl,
      destination.latitude,
      destination.longitude,
      maxMinutes,
      maxTransfers,
    ],
    queryFn: ({ signal }) => loadResult(client, options, signal),
    enabled,
    refetchOnMount: false,
    // 다른 화면(주소 검색, 비교 등)에 다녀와 동네 찾기를 다시 그려도 받아 둔 결과를 그대로 쓴다.
    gcTime: COMMUTE_RESULT_GC_MS,
    retry: false,
  });
};
