import type { QueryClient } from '@tanstack/react-query';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { usePublicConfig } from '@/shared/config/PublicConfigContext';
import type { PublicConfig } from '@/shared/config/publicConfigTypes';

import type { AdminBoundaries } from './adminBoundaryApi';
import { fetchAdminBoundaries, fetchBoundaryManifest, selectBoundaryFiles } from './adminBoundaryApi';
import { fetchCommuteAreas } from './commuteApi';

type Options = {
  config: PublicConfig;
  destination: { latitude: number; longitude: number };
  maxMinutes: number;
  maxTransfers: number;
  enabled: boolean;
};

/** 통근 결과와 manifest를 함께 받고, 결과 행정동이 속한 시도의 경계 파일만 받아 합친다. */
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
    ).map((file) =>
      client.ensureQueryData({
        queryKey: ['admin-boundaries', file.file, config.boundaryBaseUrl],
        queryFn: ({ signal }) => fetchAdminBoundaries(file, config.boundaryBaseUrl, signal),
        staleTime: Infinity,
        gcTime: 30 * 60 * 1000,
        retry: false,
      }),
    ),
  );
  signal.throwIfAborted();
  const boundaries = chunks.reduce<AdminBoundaries>((all, chunk) => Object.assign(all, chunk), {});
  return {
    ...result,
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
    retry: false,
  });
};
