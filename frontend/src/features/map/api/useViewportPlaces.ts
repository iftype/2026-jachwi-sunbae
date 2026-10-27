import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { usePublicConfig } from '@/shared/config/PublicConfigContext';

import { isInBounds, type ViewportQuery } from '../lib/mapViewportQuery';
import { fetchNearbyAgencies } from './agencyApi';
import { fetchBusStops } from './busStopApi';

/**
 * 지도 화면을 덮는 반경으로 공인중개사와 버스정류장을 함께 조회하고 화면 안의 것만 남긴다.
 * 같은 화면이면 잠시 캐시해 카카오·정류장 조회를 줄인다.
 */
export const useViewportPlaces = (query: ViewportQuery | null) => {
  const config = usePublicConfig();
  const key = [config.apiBaseUrl, query?.center.latitude, query?.center.longitude, query?.radius];
  const agencies = useQuery({
    queryKey: ['viewport-agencies', ...key],
    queryFn: ({ signal }) =>
      fetchNearbyAgencies(config, query!.center.latitude, query!.center.longitude, query!.radius, signal),
    enabled: query !== null,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const busStops = useQuery({
    queryKey: ['viewport-bus-stops', ...key],
    queryFn: ({ signal }) =>
      fetchBusStops(config, query!.center.latitude, query!.center.longitude, query!.radius, signal),
    enabled: query !== null,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const bounds = query?.bounds;
  const agencyData = agencies.data;
  const busStopData = busStops.data;
  const visibleAgencies = useMemo(
    () => (bounds ? (agencyData?.agencies ?? []).filter((agency) => isInBounds(agency, bounds)) : []),
    [agencyData, bounds],
  );
  const visibleBusStops = useMemo(
    () => (bounds ? (busStopData?.busStops ?? []).filter((stop) => isInBounds(stop, bounds)) : []),
    [busStopData, bounds],
  );
  return {
    agencies: visibleAgencies,
    busStops: visibleBusStops,
    isAgenciesLoading: query !== null && agencies.isFetching,
    agenciesFailed: agencies.isError && !agencies.isFetching,
    busStopsFailed: busStops.isError && !busStops.isFetching,
    refetch: () => Promise.all([agencies.refetch(), busStops.refetch()]),
  };
};
