import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { getMapFocusCenter } from '@/features/map/lib/mapViewportFocus';
import type { MapAddress, MapBounds } from '@/features/map/model/Map';
import type { MapMarker } from '@/features/map/model/Map';
import MapCanvas from '@/features/map/ui/map-canvas/MapCanvas';

import useAddPropertyMode from './hooks/useAddPropertyMode';
import useMapFilters from './hooks/useMapFilters';
import useMapLocation from './hooks/useMapLocation';
import useMapNearby from './hooks/useMapNearby';
import useMapProperties from './hooks/useMapProperties';
import useMapSearch from './hooks/useMapSearch';
import useMapSheet from './hooks/useMapSheet';
import { levelForRadius, type MapRadius } from './lib/mapRadius';
import { readMapView, writeMapView } from './lib/mapViewState';
import MapAddPropertySheet from './ui/map-add-property-sheet/MapAddPropertySheet';
import MapAddressSearch from './ui/map-address-search/MapAddressSearch';
import MapControls from './ui/map-controls/MapControls';
import MapNearbyCountToast from './ui/map-nearby-count-toast/MapNearbyCountToast';
import MapPropertySheet from './ui/map-property-sheet/MapPropertySheet';

import styles from './MapPage.module.css';

/** 지도 탭은 사용자가 반경을 선택했을 때만 주변 시설 반경을 표시한다. */
const INITIAL_MAP_LEVEL = 4;
const PROPERTY_MARKER_PREFIX = 'property-';

const MapPage = () => {
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

  return (
    <main className={styles.page}>
      <MapAddressSearch
        isOpen={search.searchOpen}
        locationLabel={mapLocation.locationLabel}
        query={search.searchQuery}
        results={search.searchResults}
        status={search.searchStatus}
        onOpen={search.openSearch}
        onClose={search.closeSearch}
        onQueryChange={search.changeQuery}
        onSubmit={() => void search.submitSearch()}
        onSelect={selectSearchedAddress}
      />

      <section
        ref={mapStageRef}
        className={styles.mapStage}
        aria-label="매물 지도"
        data-search-open={search.searchOpen || undefined}
        aria-hidden={search.searchOpen}
        inert={search.searchOpen}
      >
        <MapCanvas
          center={mapLocation.viewportCenter}
          markers={markers}
          circles={circles}
          radiusCenter={nearbyCenter}
          level={mapLevel}
          showRadiusLabels={false}
          showCenterPin={addMode.isAddMode}
          interactive={!addMode.isAddMode}
          selectedMarkerId={selectedPropertyId === null ? undefined : `${PROPERTY_MARKER_PREFIX}${selectedPropertyId}`}
          onSelectMarker={selectMarker}
          onSelectLocation={() => {
            if (addMode.isAddMode || selectedPropertyId === null) return;
            setSelectedPropertyId(null);
            sheet.closeSheet();
          }}
          onCenterChange={changeCenter}
          onLevelChange={setMapLevel}
          onBoundsChange={updateBounds}
        />
        <MapControls
          isAddMode={addMode.isAddMode}
          hasNearbyAnchor={hasNearbyAnchor}
          locationStatus={mapLocation.locationStatus}
          locationFailure={mapLocation.locationFailure}
          canRetryLocation={mapLocation.canRetryLocation}
          locationPermission={mapLocation.locationPermission}
          selectedRadius={selectedRadius}
          selectedCategories={selectedCategories}
          categoryCounts={categoryCounts}
          onSelectRadius={selectRadius}
          onToggleCategory={filters.toggleCategory}
          onMoveToCurrentLocation={moveToCurrentLocation}
          onEnterAddMode={enterAddMode}
        />
        {selectedRadius !== null && toastCategory !== undefined && (
          <MapNearbyCountToast
            isAddMode={addMode.isAddMode}
            radius={selectedRadius}
            category={toastCategory}
            count={categoryCounts[toastCategory] ?? 0}
          />
        )}
        {addMode.isAddMode ? (
          <MapAddPropertySheet
            address={addMode.address}
            status={addMode.addressStatus}
            onCancel={cancelAddMode}
            onConfirm={(address) => navigate('/properties/new', { state: { selectedLocation: address } })}
          />
        ) : (
          <MapPropertySheet
            sheetRef={sheet.sheetRef}
            stage={sheet.sheetStage}
            isDragging={sheet.isDragging}
            isLoading={isLoading}
            isError={isError}
            onRetry={() => void retry()}
            properties={selectedProperty === undefined ? visibleProperties : [selectedProperty]}
            selectedPropertyId={selectedPropertyId}
            onDragStart={sheet.handleDragStart}
            onDragMove={sheet.handleDragMove}
            onDragEnd={sheet.handleDragEnd}
            onDragCancel={sheet.handleDragCancel}
            onToggle={sheet.toggleSheet}
            returnState={{ mapViewKey: location.key }}
          />
        )}
      </section>
    </main>
  );
};

export default MapPage;
