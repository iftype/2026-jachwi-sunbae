import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { fetchNearby } from '@/features/map/api/mapApi';
import { clusterNearbyPlaces } from '@/features/map/lib/mapClustering';
import type { MapCoordinate } from '@/features/map/lib/mapLocation';
import { coordinatesAreClose, SEOUL_MAP_CENTER } from '@/features/map/lib/mapLocation';
import { ALL_MAP_CATEGORIES } from '@/features/map/lib/mapPresentation';
import type { MapCategory } from '@/features/map/model/Map';
import type { MapMarker } from '@/features/map/model/Map';
import type { MapRadiusCircle } from '@/features/map/model/MapCanvas';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';

export const NEARBY_RADII = [500, 1000, 2000] as const;
export type NearbyRadius = (typeof NEARBY_RADII)[number];
export type NearbyRadiusOption = 'all' | NearbyRadius;

export const nearbyRadiusLabel = (radius: NearbyRadius) => (radius === 500 ? '500m' : `${radius / 1000}km`);
const levelForRadius = (radius: NearbyRadius) => (radius === 500 ? 4 : radius === 1000 ? 5 : 6);
const toggleCategory = (categories: MapCategory[], category: MapCategory) =>
  categories.includes(category) ? categories.filter((item) => item !== category) : [...categories, category];

/** 매물 좌표를 중심으로 반경·카테고리별 주변 시설을 조회하고, 지도 탐색 상태를 관리한다. */
const useNearbyAnalysis = (propertyId: number, propertyLocation: MapCoordinate | null) => {
  const config = usePublicConfig();
  const latitude = propertyLocation?.latitude ?? null;
  const longitude = propertyLocation?.longitude ?? null;
  const center = useMemo(
    () => (latitude === null || longitude === null ? SEOUL_MAP_CENTER : { latitude, longitude }),
    [latitude, longitude],
  );
  const [viewportCenter, setViewportCenter] = useState(center);
  const [radius, setRadius] = useState<NearbyRadius>(2000);
  const [mapLevel, setMapLevel] = useState(6);
  const [selectedCategories, setSelectedCategories] = useState<MapCategory[]>([]);
  const [isListExpanded, setIsListExpanded] = useState(false);
  const [isAllMode, setIsAllMode] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  const nearby = useQuery({
    queryKey: ['nearby', propertyId, latitude, longitude, radius, ALL_MAP_CATEGORIES.join(',')],
    queryFn: ({ signal }) => fetchNearby(config, latitude ?? 0, longitude ?? 0, radius, ALL_MAP_CATEGORIES, signal),
    enabled: latitude !== null && longitude !== null,
  });

  useEffect(() => {
    setViewportCenter(center);
  }, [center]);

  const places = useMemo(
    () => nearby.data?.places.filter((place) => selectedCategories.includes(place.category)) ?? [],
    [nearby.data?.places, selectedCategories],
  );
  const selectedPlace = useMemo(
    () => places.find((place) => place.providerPlaceId === selectedPlaceId) ?? null,
    [places, selectedPlaceId],
  );

  useEffect(() => {
    if (selectedPlaceId !== null && selectedPlace === null) setSelectedPlaceId(null);
  }, [selectedPlace, selectedPlaceId]);

  const markers = useMemo<MapMarker[]>(
    () => [
      { id: `selected-property-${propertyId}`, ...center, label: '선택한 매물', tone: 'selected' },
      ...clusterNearbyPlaces(places, mapLevel),
    ],
    [center, mapLevel, places, propertyId],
  );
  const circles = useMemo<MapRadiusCircle[]>(
    () =>
      NEARBY_RADII.filter((value) => value <= radius).map((value) => ({
        radiusMeters: value,
        label: nearbyRadiusLabel(value),
      })),
    [radius],
  );

  const selectRadius = (value: NearbyRadiusOption) => {
    setSelectedPlaceId(null);
    setViewportCenter(center);
    if (value === 'all') {
      setRadius(2000);
      setMapLevel(6);
      setSelectedCategories(ALL_MAP_CATEGORIES);
      setIsAllMode(true);
      return;
    }
    setRadius(value);
    setMapLevel(levelForRadius(value));
    setIsAllMode(false);
  };

  const selectCategory = (category: MapCategory) => {
    setSelectedCategories((current) => toggleCategory(current, category));
    setIsAllMode(false);
  };

  const selectMarker = (marker: MapMarker) => {
    if (marker.tone === 'cluster') {
      setViewportCenter({ latitude: marker.latitude, longitude: marker.longitude });
      setMapLevel((current) => Math.max(3, current - 1));
      setSelectedPlaceId(null);
    } else if (marker.placeId !== undefined) {
      setSelectedPlaceId(marker.placeId);
      setIsListExpanded(false);
    }
  };

  const panTo = (nextLatitude: number, nextLongitude: number) => {
    const nextCenter = { latitude: nextLatitude, longitude: nextLongitude };
    setViewportCenter((current) => (coordinatesAreClose(current, nextCenter) ? current : nextCenter));
  };

  const toggleList = () => {
    setIsListExpanded((current) => !current);
    if (!isListExpanded) setSelectedPlaceId(null);
  };

  return {
    nearby,
    center,
    viewportCenter,
    radius,
    mapLevel,
    setMapLevel,
    isAllMode,
    selectedCategories,
    places,
    selectedPlace,
    isListExpanded,
    markers,
    circles,
    selectRadius,
    selectCategory,
    selectMarker,
    panTo,
    toggleList,
    closePlace: () => setSelectedPlaceId(null),
  };
};

export default useNearbyAnalysis;
