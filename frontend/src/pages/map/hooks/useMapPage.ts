import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { getMapFocusCenter } from '@/features/map/lib/mapViewportFocus';
import type { MapAddress, MapBounds } from '@/features/map/model/Map';
import type { MapMarker } from '@/features/map/model/Map';
import type { MapCoordinateMenu, MapTapAction } from '@/features/map/model/MapCanvas';
import useStreetMemoLayer from '@/features/street-memo/hooks/useStreetMemoLayer';

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
const TAP_MARKER_ID = 'tap-point';

type MapPoint = { latitude: number; longitude: number };

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
  const memo = useStreetMemoLayer(filters.selectedCategories.includes('MEMO') && !addMode.isAddMode, bounds);
  // 지도의 빈 곳을 찍은 위치. 여기서 메모를 남길지 매물을 등록할지 고른다.
  const [tapPoint, setTapPoint] = useState<MapPoint | null>(null);
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
      ...memo.markers,
      ...(currentPosition === null
        ? []
        : [{ id: 'current-location', ...currentPosition, label: '현재 위치', tone: 'current' as const }]),
      ...(tapPoint === null
        ? []
        : [{ id: TAP_MARKER_ID, ...tapPoint, label: '선택한 위치', tone: 'destination' as const }]),
    ];
  }, [currentPosition, facilityMarkers, propertyMarkers, memo.markers, tapPoint]);

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
    if (!addMode.isAddMode && memo.selectMarker(marker)) {
      setTapPoint(null);
      setSelectedPropertyId(null);
      return;
    }
    if (marker.tone === 'propertyCluster') {
      mapLocation.moveToCoordinate({ latitude: marker.latitude, longitude: marker.longitude });
      setMapLevel((current) => Math.max(1, current - 1));
      return;
    }
    if (!addMode.isAddMode && marker.tone === 'property') {
      setTapPoint(null);
      memo.close();
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

  const enterAddModeAt = (point: MapPoint) => {
    setTapPoint(null);
    memo.close();
    setHasNearbyAnchor(true);
    filters.ensureRadius();
    setSelectedPropertyId(null);
    sheet.closeSheet();
    // 추가 모드는 화면 가운데 핀으로 위치를 고르므로, 찍은 위치에서 시작하면 그 자리를 가운데로 옮긴다.
    mapLocation.moveToCoordinate(point);
    addMode.enter(point);
  };
  const enterAddMode = () => enterAddModeAt(mapLocation.viewportCenter);

  const cancelAddMode = () => {
    setNearbyAnchor(mapLocation.viewportCenter);
    addMode.cancel();
  };

  const { selectedRadius, selectedCategories } = filters;
  // 거리 메모는 반경 안 시설 개수가 아니라 화면 안 메모라 개수 안내를 띄우지 않는다.
  const toastCategory =
    selectedCategories.length === 1 && selectedCategories[0] !== 'MEMO' ? selectedCategories[0] : undefined;

  const listProperties = selectedProperty === undefined ? visibleProperties : [selectedProperty];
  const confirmAddProperty = (address: MapAddress) =>
    navigate('/properties/new', { state: { selectedLocation: address } });
  const closeSelection = () => {
    if (addMode.isAddMode || selectedPropertyId === null) return;
    setSelectedPropertyId(null);
    sheet.closeSheet();
  };

  /**
   * 지도의 빈 곳을 찍으면, 열려 있는 매물·메모·동작 목록이 있으면 닫기만 하고 아니면 그 자리에서 할 일을 고르게 한다.
   * 무언가를 닫으려고 찍었는데 바로 새 동작 목록이 뜨면 다시 닫아야 해서 두 단계로 나눈다.
   */
  const tapLocation = (latitude: number, longitude: number) => {
    if (addMode.isAddMode) return;
    if (selectedPropertyId !== null || memo.mode !== null || tapPoint !== null) {
      closeSelection();
      memo.close();
      setTapPoint(null);
      return;
    }
    setTapPoint({ latitude, longitude });
  };
  const closeTap = () => setTapPoint(null);
  const tapActions: MapTapAction[] =
    tapPoint === null
      ? []
      : [
          {
            id: 'street-memo',
            label: '📝 여기에 메모 남기기',
            onSelect: () => {
              setTapPoint(null);
              memo.startDraft(tapPoint);
            },
          },
          { id: 'property', label: '🏠 여기에 매물 등록하기', onSelect: () => enterAddModeAt(tapPoint) },
        ];
  const coordinateMenu: MapCoordinateMenu | undefined =
    tapPoint === null ? undefined : { ...tapPoint, actions: tapActions, onClose: closeTap };
  // 방금 쓴 메모가 보이도록 메모 카테고리를 켠다.
  const showCreatedMemo = () => filters.showCategory('MEMO');
  const selectedMarkerId =
    selectedPropertyId !== null ? `${PROPERTY_MARKER_PREFIX}${selectedPropertyId}` : memo.selectedMarkerId;

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
    memo,
    tapPoint,
    tapActions,
    coordinateMenu,
    tapLocation,
    closeTap,
    showCreatedMemo,
    selectedMarkerId,
  };
};

export type MapPageState = ReturnType<typeof useMapPage>;

export default useMapPage;
