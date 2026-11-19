import { skipToken, useQuery } from '@tanstack/react-query';

import { fetchPropertyCommuteRoute } from '@/features/map/api/commuteRouteApi';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';

import { describeRouteError, type NeighborhoodPreviewContext } from './useNeighborhoodPreview';

/** 내 매물에서 출퇴근 장소까지의 동선. 통근 시간이 나온 매물만 부르고, 매물별 통근 시간과 같은 조건(60분, 환승 2회)으로 찾는다. */
const usePropertyRoute = (preview: Pick<NeighborhoodPreviewContext, 'destination'>, propertyId: number | null) => {
  const config = usePublicConfig();
  const route = useQuery({
    queryKey: [
      'property-commute-route',
      config.apiBaseUrl,
      preview.destination.latitude,
      preview.destination.longitude,
      propertyId,
    ],
    queryFn:
      propertyId === null
        ? skipToken
        : ({ signal }) => fetchPropertyCommuteRoute(config, preview.destination, propertyId, signal),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return {
    route: propertyId === null ? undefined : route.data,
    isLoading: propertyId !== null && route.isFetching && route.data === undefined,
    error: propertyId !== null && route.isError && !route.isFetching ? describeRouteError(route.error) : null,
    retry: () => route.refetch(),
  };
};

export default usePropertyRoute;
