import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { getMapFocusCenter } from '@/features/map/lib/mapViewportFocus';
import type { MapAddress, MapBounds } from '@/features/map/model/Map';
import type { MapMarker } from '@/features/map/model/Map';

import { levelForRadius, type MapRadius } from '../lib/mapRadius';
import { readMapView, writeMapView } from '../lib/mapViewState';
import useAddPropertyMode from './useAddPropertyMode';
import useMapFilters from './useMapFilters';
import useMapLocation from './useMapLocation';
import useMapNearby from './useMapNearby';
import useMapProperties from './useMapProperties';
import useMapSearch from './useMapSearch';
import useMapSheet from './useMapSheet';

/** 현재 위치 또는 선택한 매물 좌표에서 반경별 주변 시설을 탐색한다. */
const INITIAL_MAP_LEVEL = levelForRadius(500);
export const PROPERTY_MARKER_PREFIX = 'property-';

/** 인프라 지도 화면의 상태와 동작. 데스크탑·휴대폰 화면이 함께 쓴다. */
const useMapPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [initialView] = useState(() => readMapView(location.key, location.state));
  const [mapLevel, setMapLevel] = useState(initialView?.level ?? INITIAL_MAP_LEVEL);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(initialView?.selectedPropertyId ?? null);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const updateBounds = useCallback((next: MapBounds) => {
    setBounds((current) =>
      current !== null &&
      current.south === next.south &&
      current.north === next.north &&
      current.west === next.west &&
      current.east === next.east
        ? current
        : next,
    );
  }, []);
  const search = useMapSearch();
  const filters = useMapFilters(initialView);
  const addMode = useAddPropertyMode();
  const sheet = useMapSheet(!search.searchOpen && !addMode.isAddMode, initialView?.sheetStage);
  const mapLocation = useMapLocation(initialView?.center);
  const [nearbyAnchor, setNearbyAnchor] = useState(initialView?.nearbyAnchor ?? mapLocation.viewportCenter);
  const [hasNearbyAnchor, setHasNearbyAnchor] = useState(initialView?.hasNearbyAnchor ?? false);
  const mapStageRef = useRef<HTMLElement | null>(null);
  const { getFallbackCoordinate, mappedProperties, visibleProperties, propertyMarkers, isLoading, isError, retry } =
    useMapProperties(mapLocation.viewportCenter, mapLevel, bounds, selectedPropertyId);
  const selectedProperty = mappedProperties.find((property) => property.propertyId === selectedPropertyId);
  useEffect(() => {
    if (addMode.isAddMode) return;
    writeMapView(location.key, {
      center: mapLocation.viewportCenter,
      level: mapLevel,
      selectedPropertyId,
      nearbyAnchor,
      hasNearbyAnchor,
      radius: filters.selectedRadius,
      categories: filters.selectedCategories,
      sheetStage: sheet.sheetStage,
    });
  }, [
    location.key,
    mapLocation.viewportCenter,
    mapLevel,
    selectedPropertyId,
    nearbyAnchor,
    hasNearbyAnchor,
    filters.selectedRadius,
    filters.selectedCategories,
    sheet.sheetStage,
    addMode.isAddMode,
  ]);
  // 추가 모드의 중앙 핀만 지도 이동을 따라간다. 일반 탐색 반경은 마지막 선택 좌표에 고정한다.
  const nearbyCenter = addMode.isAddMode ? mapLocation.viewportCenter : nearbyAnchor;
  const { facilityMarkers, categoryCounts, circles } = useMapNearby(
    nearbyCenter,
    mapLevel,
    filters.selectedCategories,
    filters.selectedRadius,
  );

  const { currentPosition } = mapLocation;
  useEffect(() => {
    if (initialView !== undefined || currentPosition === null || hasNearbyAnchor || addMode.isAddMode) return;
    setNearbyAnchor(currentPosition);
    setHasNearbyAnchor(true);
    filters.ensureRadius();
  }, [initialView, currentPosition, hasNearbyAnchor, addMode.isAddMode, filters.ensureRadius]);
  const markers = useMemo<MapMarker[]>(() => {
    // 매물 추가 중에도 내가 어디에 있는지는 계속 보여 준다. 중앙 선택 핀과 역할이 다르다.
    return [
      ...propertyMarkers,
      ...facilityMarkers,
      ...(currentPosition === null
        ? []
        : [{ id: 'current-location', ...currentPosition, label: '현재 위치', tone: 'current' as const }]),
    ];
  }, [currentPosition, facilityMarkers, propertyMarkers]);

  const moveToCurrentLocation = () => {
    void mapLocation.moveToCurrentLocation(getFallbackCoordinate).then((coordinate) => {
      if (coordinate === null) return;
      setSelectedPropertyId(null);
      setNearbyAnchor(coordinate);
      setHasNearbyAnchor(true);
      filters.ensureRadius();
    });
  };

  const selectProperty = (propertyId: number) => {
    const property = mappedProperties.find((item) => item.propertyId === propertyId);
    if (property?.location.latitude == null || property.location.longitude == null) return;
    setSelectedPropertyId(propertyId);
    const coordinate = { latitude: property.location.latitude, longitude: property.location.longitude };
    setNearbyAnchor(coordinate);
    setHasNearbyAnchor(true);
    const viewport = mapStageRef.current?.getBoundingClientRect();
    mapLocation.moveToCoordinate(
      getMapFocusCenter(coordinate, mapLevel, viewport?.width || 390, viewport?.height || 640),
    );
    filters.ensureRadius();
    sheet.previewSheet();
  };

  const selectSearchedAddress = (address: MapAddress) => {
    setSelectedPropertyId(null);
    setNearbyAnchor({ latitude: address.latitude, longitude: address.longitude });
    setHasNearbyAnchor(true);
    mapLocation.moveToAddress(address);
    addMode.handleCenterChange(address);
    setMapLevel(INITIAL_MAP_LEVEL);
    search.closeSearch();
  };

  const selectMarker = (marker: MapMarker) => {
    if (marker.tone === 'propertyCluster') {
      mapLocation.moveToCoordinate({ latitude: marker.latitude, longitude: marker.longitude });
      setMapLevel((current) => Math.max(1, current - 1));
      return;
    }
    if (!addMode.isAddMode && marker.tone === 'property') {
      selectProperty(Number(marker.id.slice(PROPERTY_MARKER_PREFIX.length)));
    }
  };

  const selectRadius = (radius: MapRadius) => {
    if (!hasNearbyAnchor && !addMode.isAddMode) return;
    if (!filters.toggleRadius(radius)) return;
    const nextLevel = levelForRadius(radius);
    setMapLevel(nextLevel);
    if (!addMode.isAddMode && selectedPropertyId !== null) {
      const viewport = mapStageRef.current?.getBoundingClientRect();
      mapLocation.moveToCoordinate(
        getMapFocusCenter(nearbyAnchor, nextLevel, viewport?.width || 390, viewport?.height || 640),
      );
    }
  };

  const changeCenter = (latitude: number, longitude: number) => {
    const coordinate = { latitude, longitude };
    mapLocation.panTo(coordinate);
    addMode.handleCenterChange(coordinate);
  };

  const enterAddMode = () => {
    setHasNearbyAnchor(true);
    filters.ensureRadius();
    setSelectedPropertyId(null);
    sheet.closeSheet();
    addMode.enter(mapLocation.viewportCenter);
  };

  const cancelAddMode = () => {
    setNearbyAnchor(mapLocation.viewportCenter);
    addMode.cancel();
  };

  const { selectedRadius, selectedCategories } = filters;
  const toastCategory = selectedCategories.length === 1 ? selectedCategories[0] : undefined;

  const listProperties = selectedProperty === undefined ? visibleProperties : [selectedProperty];
  const confirmAddProperty = (address: MapAddress) =>
    navigate('/properties/new', { state: { selectedLocation: address } });
  const closeSelection = () => {
    if (addMode.isAddMode || selectedPropertyId === null) return;
    setSelectedPropertyId(null);
    sheet.closeSheet();
  };

  return {
    locationKey: location.key,
    mapStageRef,
    search,
    filters,
    addMode,
    sheet,
    mapLocation,
    mapLevel,
    setMapLevel,
    markers,
    circles,
    categoryCounts,
    nearbyCenter,
    hasNearbyAnchor,
    selectedPropertyId,
    selectedRadius,
    selectedCategories,
    toastCategory,
    listProperties,
    isLoading,
    isError,
    retry,
    updateBounds,
    selectMarker,
    selectRadius,
    selectSearchedAddress,
    changeCenter,
    moveToCurrentLocation,
    enterAddMode,
    cancelAddMode,
    confirmAddProperty,
    closeSelection,
  };
};

export type MapPageState = ReturnType<typeof useMapPage>;

export default useMapPage;
