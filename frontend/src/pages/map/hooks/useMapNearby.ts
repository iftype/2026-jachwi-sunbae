import { useMemo } from 'react';

import { useNearbyFacilities } from '@/features/map/api/useNearbyFacilities';
import { clusterNearbyPlaces } from '@/features/map/lib/mapClustering';
import type { MapCoordinate } from '@/features/map/lib/mapLocation';
import type { MapCategory } from '@/features/map/model/Map';
import type { MapRadiusCircle } from '@/features/map/model/MapCanvas';

import { type MapRadius, RADIUS_OPTIONS, radiusLabel } from '../lib/mapRadius';

const useMapNearby = (
  queryCenter: MapCoordinate,
  mapLevel: number,
  selectedCategories: MapCategory[],
  selectedRadius: MapRadius | null,
) => {
  const nearbyRadius = selectedRadius ?? 500;
  const nearby = useNearbyFacilities(queryCenter, nearbyRadius, selectedCategories);

  const filteredPlaces = useMemo(
    () => nearby.data?.places.filter((place) => selectedCategories.includes(place.category)) ?? [],
    [nearby.data?.places, selectedCategories],
  );

  const facilityMarkers = useMemo(() => clusterNearbyPlaces(filteredPlaces, mapLevel), [filteredPlaces, mapLevel]);

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<MapCategory, number>> = {};
    nearby.data?.places.forEach((place) => {
      counts[place.category] = (counts[place.category] ?? 0) + 1;
    });
    return counts;
  }, [nearby.data?.places]);

  const circles = useMemo<MapRadiusCircle[]>(
    () =>
      selectedRadius === null
        ? []
        : RADIUS_OPTIONS.filter((value) => value <= selectedRadius).map((value) => ({
            radiusMeters: value,
            label: radiusLabel(value),
          })),
    [selectedRadius],
  );

  return { nearby, filteredPlaces, facilityMarkers, categoryCounts, circles };
};

export default useMapNearby;
