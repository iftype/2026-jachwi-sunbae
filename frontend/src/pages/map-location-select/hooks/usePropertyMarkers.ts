import { useMemo } from 'react';

import { DEFAULT_MAP_CENTER } from '@/features/map/lib/mapLocation';
import type { MapMarker } from '@/features/map/model/Map';
import { usePropertyList } from '@/features/property/api/useProperties';

/** 위치를 고를 때 참고하도록 이미 등록한 매물을 지도 마커로 보여 준다. */
const usePropertyMarkers = () => {
  const properties = usePropertyList();

  return useMemo<MapMarker[]>(
    () =>
      (properties.data?.pages.flatMap((page) => page.content) ?? [])
        .filter((property) => property.location.latitude !== null && property.location.longitude !== null)
        .map((property) => ({
          id: `property-${property.propertyId}`,
          latitude: property.location.latitude ?? DEFAULT_MAP_CENTER.latitude,
          longitude: property.location.longitude ?? DEFAULT_MAP_CENTER.longitude,
          label: property.name,
          tone: 'property',
        })),
    [properties.data?.pages],
  );
};

export default usePropertyMarkers;
