import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { usePublicConfig } from '@/shared/config/PublicConfigContext';

import type { MapCoordinate } from '../lib/mapLocation';
import type { MapCategory, NearbyCategory, NearbyPlace } from '../model/Map';
import { fetchBusStops } from './busStopApi';
import { fetchNearby } from './mapApi';

const CATEGORIES: NearbyCategory[] = ['HOSPITAL', 'SCHOOL', 'CONVENIENCE', 'AGENCY'];
export const useNearbyFacilities = (
  center: MapCoordinate,
  radius: 500 | 1000 | 2000,
  selectedCategories: MapCategory[],
  enabled = true,
  options: { loadAllCategories?: boolean } = {},
) => {
  const config = usePublicConfig();
  const needsTransport = options.loadAllCategories === true || selectedCategories.includes('TRANSPORT');
  const needsNearby =
    options.loadAllCategories === true ||
    selectedCategories.length === 0 ||
    selectedCategories.some((category) => category !== 'TRANSPORT' && category !== 'MEMO');
  const nearby = useQuery({
    queryKey: ['nearby-facilities', config.apiBaseUrl, center.latitude, center.longitude, radius],
    queryFn: ({ signal }) => fetchNearby(config, center.latitude, center.longitude, radius, CATEGORIES, signal),
    enabled: enabled && needsNearby,
  });
  const transport = useQuery({
    queryKey: ['bus-stops', config.apiBaseUrl, center.latitude, center.longitude, radius],
    queryFn: ({ signal }) => fetchBusStops(config, center.latitude, center.longitude, radius, signal),
    enabled: enabled && needsTransport,
  });
  const data = useMemo(() => {
    const stops: NearbyPlace[] = (transport.data?.busStops ?? []).map((stop) => ({
      providerPlaceId: stop.nodeId,
      name: stop.name,
      latitude: stop.latitude,
      longitude: stop.longitude,
      distanceMeters: stop.distanceMeters,
      category: 'TRANSPORT',
      address: '',
    }));
    return {
      center,
      radius,
      counts: {
        HOSPITAL: 0,
        SCHOOL: 0,
        CONVENIENCE: 0,
        AGENCY: 0,
        ...nearby.data?.counts,
        TRANSPORT: transport.data?.count ?? 0,
      },
      places: [...(nearby.data?.places ?? []), ...(needsTransport ? stops : [])],
    };
  }, [nearby.data, transport.data, needsTransport, center.latitude, center.longitude, radius]);
  return {
    data,
    isPending: enabled && ((needsNearby && nearby.isPending) || (needsTransport && transport.isPending)),
    isError: (needsNearby && nearby.isError) || (needsTransport && transport.isError),
    isSuccess: enabled && (!needsNearby || nearby.isSuccess) && (!needsTransport || transport.isSuccess),
    error: needsTransport && transport.isError ? transport.error : needsNearby ? nearby.error : null,
    refetch: () =>
      Promise.all([...(needsNearby ? [nearby.refetch()] : []), ...(needsTransport ? [transport.refetch()] : [])]),
  };
};
