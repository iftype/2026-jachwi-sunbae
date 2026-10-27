import { useQuery } from '@tanstack/react-query';

import { fetchCommuteRoute } from '@/features/map/api/commuteRouteApi';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';

import { describeRouteError, type NeighborhoodPreviewContext } from './useNeighborhoodPreview';

/**
 * 고른 정류장(경로망 정류장 ID)에서 출발해 목적지까지 가는 경로. 동네 결과와 같은 조건(통근 시간·환승)으로 찾고,
 * 같은 정류장이면 동네 상세 경로와 캐시를 함께 쓴다.
 */
const usePlaceRoute = (
  preview: Pick<NeighborhoodPreviewContext, 'destination' | 'maxMinutes' | 'maxTransfers'>,
  stopId: string | null,
) => {
  const config = usePublicConfig();
  const route = useQuery({
    queryKey: [
      'commute-route',
      config.apiBaseUrl,
      preview.destination.latitude,
      preview.destination.longitude,
      stopId,
      preview.maxMinutes,
      preview.maxTransfers,
    ],
    queryFn: ({ signal }) =>
      fetchCommuteRoute(config, preview.destination, stopId!, preview.maxMinutes, preview.maxTransfers, signal),
    enabled: stopId !== null,
    // 시트 요약과 전체 화면 경로가 같은 경로를 쓰므로, 화면을 오갈 때마다 다시 부르지 않는다.
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return {
    route: stopId === null ? undefined : route.data,
    isLoading: stopId !== null && route.isFetching && route.data === undefined,
    error: stopId !== null && route.isError && !route.isFetching ? describeRouteError(route.error) : null,
    retry: () => route.refetch(),
  };
};

export default usePlaceRoute;
