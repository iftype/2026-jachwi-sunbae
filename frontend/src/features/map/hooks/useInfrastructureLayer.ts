import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import useDebouncedValue from '@/shared/lib/hooks/useDebouncedValue';

import { useViewportPlaces } from '../api/useViewportPlaces';
import { facilityMarkersVisible } from '../lib/mapFacilityVisibility';
import type { FacilityCategory } from '../lib/mapPresentation';
import type { MapBounds, MapCategory, MapMarker } from '../model/Map';
import useFacilityFocus from './useFacilityFocus';
import useViewportFacilityLayer from './useViewportFacilityLayer';

type Category = FacilityCategory;
export type InfrastructurePlace = {
  id: string;
  name: string;
  category: MapCategory;
  latitude: number;
  longitude: number;
  address: string;
  phone?: string | null;
};

const useInfrastructureLayer = (enabled: boolean, bounds: MapBounds | null, level: number, markerLevel: number) => {
  const client = useQueryClient();
  const [category, setCategory] = useFacilityFocus();
  const [selected, setSelected] = useState<InfrastructurePlace | null>(null);
  const isClose = facilityMarkersVisible(level, markerLevel);
  const settledBounds = useDebouncedValue(enabled && isClose && category ? bounds : null, 300);
  const places = useViewportPlaces(settledBounds, {
    agencies: category === 'AGENCY',
    busStops: category === 'TRANSPORT',
  });
  const facilities = useViewportFacilityLayer(
    settledBounds,
    category === 'HOSPITAL' || category === 'CONVENIENCE' ? category : null,
  );
  const rows = useMemo<InfrastructurePlace[]>(() => {
    if (!enabled || !isClose || !category) return [];
    if (category === 'AGENCY')
      return places.agencies.map((place) => ({
        ...place,
        id: `infrastructure:agency:${place.providerPlaceId}`,
        category,
      }));
    if (category === 'TRANSPORT')
      return places.busStops.map((place) => ({
        ...place,
        id: `infrastructure:stop:${place.nodeId}`,
        category,
        address: '',
      }));
    return facilities.places.map((place) => ({ ...place, id: `infrastructure:place:${place.providerPlaceId}` }));
  }, [enabled, isClose, category, places.agencies, places.busStops, facilities.places]);
  const markers = useMemo<MapMarker[]>(
    () =>
      rows.map((place) => ({
        id: place.id,
        label: place.name,
        latitude: place.latitude,
        longitude: place.longitude,
        category: place.category,
        tone: 'place',
        actionable: true,
      })),
    [rows],
  );
  const queryPrefix =
    category === 'AGENCY'
      ? 'viewport-agencies'
      : category === 'TRANSPORT'
        ? 'viewport-bus-stops'
        : 'viewport-facilities';
  const fetching = useIsFetching({ queryKey: [queryPrefix] }) > 0;
  return {
    category,
    rows,
    markers,
    selected,
    fetching,
    isClose,
    isError:
      category === 'AGENCY'
        ? places.agenciesFailed
        : category === 'TRANSPORT'
          ? places.busStopsFailed
          : facilities.isError,
    retry: () => client.invalidateQueries({ queryKey: [queryPrefix] }),
    selectCategory: (next: Category) => {
      setCategory(category === next ? null : next);
      setSelected(null);
    },
    selectMarker: (marker: MapMarker) => {
      const place = rows.find((row) => row.id === marker.id);
      if (!place) return false;
      setSelected(place);
      return true;
    },
    selectPlace: setSelected,
    clearSelection: () => setSelected(null),
  };
};
export type InfrastructureLayer = ReturnType<typeof useInfrastructureLayer>;
export default useInfrastructureLayer;
