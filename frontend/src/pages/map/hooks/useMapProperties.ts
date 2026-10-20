import { useCallback, useEffect, useMemo, useRef } from 'react';

import { clusterProperties } from '@/features/map/lib/mapClustering';
import type { MapCoordinate } from '@/features/map/lib/mapLocation';
import { PANGYO_MAP_CENTER } from '@/features/map/lib/mapLocation';
import type { MapBounds } from '@/features/map/model/Map';
import type { MapMarker } from '@/features/map/model/Map';
import { usePropertyList } from '@/features/property/api/useProperties';
import type { PropertySummary } from '@/features/property/model/Property';

const getViewportSpan = (level: number) => {
  const baseLat = 0.0035 * Math.pow(2, Math.max(0, level - 2));
  const baseLng = 0.0045 * Math.pow(2, Math.max(0, level - 2));
  return { latSpan: baseLat, lngSpan: baseLng };
};

const useMapProperties = (
  viewportCenter: MapCoordinate,
  mapLevel: number,
  bounds: MapBounds | null = null,
  selectedPropertyId: number | null = null,
) => {
  const properties = usePropertyList();
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = properties;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);
  const items = useMemo(() => properties.data?.pages.flatMap((page) => page.content) ?? [], [properties.data]);
  const mapped = useMemo(
    () => items.filter((item) => item.location.latitude !== null && item.location.longitude !== null),
    [items],
  );
  const mappedRef = useRef<PropertySummary[]>(mapped);
  mappedRef.current = mapped;
  const getFallbackCoordinate = useCallback(() => {
    const property = mappedRef.current[0];
    if (property?.location.latitude == null || property.location.longitude == null) return undefined;
    return { latitude: property.location.latitude, longitude: property.location.longitude, label: property.name };
  }, []);
  const visibleProperties = useMemo(() => {
    const { latSpan, lngSpan } = getViewportSpan(mapLevel);
    return mapped.filter((item) => {
      if (item.location.latitude === null || item.location.longitude === null) return false;
      if (bounds !== null) {
        return (
          item.location.latitude >= bounds.south &&
          item.location.latitude <= bounds.north &&
          item.location.longitude >= bounds.west &&
          item.location.longitude <= bounds.east
        );
      }
      const latDiff = Math.abs(item.location.latitude - viewportCenter.latitude);
      const lngDiff = Math.abs(item.location.longitude - viewportCenter.longitude);
      return latDiff <= latSpan && lngDiff <= lngSpan;
    });
  }, [bounds, mapped, mapLevel, viewportCenter.latitude, viewportCenter.longitude]);

  // 매물 핀은 사진 대신 모두 자취선배 로고로 그린다.
  const propertyMarkers = useMemo<MapMarker[]>(
    () => [
      ...clusterProperties(
        visibleProperties
          .filter((item) => item.propertyId !== selectedPropertyId)
          .map((item) => ({
            propertyId: item.propertyId,
            name: item.name,
            latitude: item.location.latitude ?? PANGYO_MAP_CENTER.latitude,
            longitude: item.location.longitude ?? PANGYO_MAP_CENTER.longitude,
            caption: '',
          })),
        mapLevel,
      ),
      ...visibleProperties
        .filter((item) => item.propertyId === selectedPropertyId)
        .map((item) => ({
          id: `property-${item.propertyId}`,
          latitude: item.location.latitude ?? PANGYO_MAP_CENTER.latitude,
          longitude: item.location.longitude ?? PANGYO_MAP_CENTER.longitude,
          label: item.name,
          tone: 'property' as const,
          actionable: true,
        })),
    ],
    [mapLevel, selectedPropertyId, visibleProperties],
  );

  return {
    getFallbackCoordinate,
    mappedProperties: mapped,
    visibleProperties,
    propertyMarkers,
    isLoading: properties.isPending,
    isError: properties.isError || isFetchNextPageError,
    retry: properties.refetch,
  };
};

export default useMapProperties;
