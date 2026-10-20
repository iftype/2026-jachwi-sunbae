import type { ReactNode } from 'react';

import MapCanvas from '@/features/map/ui/map-canvas/MapCanvas';

import { type MapPageState, PROPERTY_MARKER_PREFIX } from '../../hooks/useMapPage';
import MapAddPropertySheet from '../map-add-property-sheet/MapAddPropertySheet';
import MapControls from '../map-controls/MapControls';
import MapNearbyCountToast from '../map-nearby-count-toast/MapNearbyCountToast';

import styles from './MapStage.module.css';

type MapStageProps = {
  map: MapPageState;
  className?: string;
  /** 추가 모드가 아닐 때 지도 위에 함께 띄울 요소(휴대폰 매물 바텀시트 등). */
  children?: ReactNode;
};

/** 인프라 지도 본체: 지도, 반경·시설 조작, 주변 시설 개수 안내, 매물 추가 모드 시트. */
const MapStage = ({ map, className, children }: MapStageProps) => {
  const { addMode, search, mapLocation, filters, selectedRadius, toastCategory } = map;

  return (
    <section
      ref={map.mapStageRef}
      className={`${styles.mapStage} ${className ?? ''}`.trim()}
      aria-label="매물 지도"
      data-search-open={search.searchOpen || undefined}
      aria-hidden={search.searchOpen}
      inert={search.searchOpen}
    >
      <MapCanvas
        center={mapLocation.viewportCenter}
        markers={map.markers}
        circles={map.circles}
        radiusCenter={map.nearbyCenter}
        level={map.mapLevel}
        showRadiusLabels={false}
        showCenterPin={addMode.isAddMode}
        interactive={!addMode.isAddMode}
        selectedMarkerId={
          map.selectedPropertyId === null ? undefined : `${PROPERTY_MARKER_PREFIX}${map.selectedPropertyId}`
        }
        onSelectMarker={map.selectMarker}
        onSelectLocation={map.closeSelection}
        onCenterChange={map.changeCenter}
        onLevelChange={map.setMapLevel}
        onBoundsChange={map.updateBounds}
      />
      <MapControls
        isAddMode={addMode.isAddMode}
        hasNearbyAnchor={map.hasNearbyAnchor}
        locationStatus={mapLocation.locationStatus}
        locationFailure={mapLocation.locationFailure}
        canRetryLocation={mapLocation.canRetryLocation}
        locationPermission={mapLocation.locationPermission}
        selectedRadius={selectedRadius}
        selectedCategories={map.selectedCategories}
        categoryCounts={map.categoryCounts}
        onSelectRadius={map.selectRadius}
        onToggleCategory={filters.toggleCategory}
        onMoveToCurrentLocation={map.moveToCurrentLocation}
        onEnterAddMode={map.enterAddMode}
      />
      {selectedRadius !== null && toastCategory !== undefined && (
        <MapNearbyCountToast
          isAddMode={addMode.isAddMode}
          radius={selectedRadius}
          category={toastCategory}
          count={map.categoryCounts[toastCategory] ?? 0}
        />
      )}
      {addMode.isAddMode ? (
        <MapAddPropertySheet
          address={addMode.address}
          status={addMode.addressStatus}
          onCancel={map.cancelAddMode}
          onConfirm={map.confirmAddProperty}
        />
      ) : (
        children
      )}
    </section>
  );
};

export default MapStage;
