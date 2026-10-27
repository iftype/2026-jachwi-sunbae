import type { MapLocationFailure } from '@/features/map/lib/mapLocation';
import type { MapCategory } from '@/features/map/model/Map';
import MapCategoryRail from '@/features/map/ui/map-category-rail/MapCategoryRail';
import MapCurrentLocationButton from '@/features/map/ui/map-current-location-button/MapCurrentLocationButton';
import MapRadiusSelector from '@/features/map/ui/map-radius-selector/MapRadiusSelector';
import PageAction from '@/shared/ui/page-action/PageAction';

import { type MapRadius, RADIUS_OPTIONS, radiusLabel } from '../../lib/mapRadius';
import MapLocationStatus from '../map-location-status/MapLocationStatus';

import styles from './MapControls.module.css';

type MapControlsProps = {
  isAddMode: boolean;
  hasNearbyAnchor: boolean;
  locationStatus: 'ready' | 'locating' | 'fallback';
  locationFailure: MapLocationFailure;
  canRetryLocation: boolean;
  locationPermission: PermissionState | 'unknown';
  selectedRadius: MapRadius | null;
  selectedCategories: MapCategory[];
  categoryCounts: Partial<Record<MapCategory, number>>;
  onSelectRadius: (radius: MapRadius) => void;
  onToggleCategory: (category: MapCategory) => void;
  onMoveToCurrentLocation: () => void;
  onEnterAddMode: () => void;
};

const MapControls = ({
  isAddMode,
  hasNearbyAnchor,
  locationStatus,
  locationFailure,
  canRetryLocation,
  locationPermission,
  selectedRadius,
  selectedCategories,
  categoryCounts,
  onSelectRadius,
  onToggleCategory,
  onMoveToCurrentLocation,
  onEnterAddMode,
}: MapControlsProps) => (
  <>
    <>
      <MapRadiusSelector
        className={styles.radiusSelector}
        label="시설 확인 반경"
        disabled={!hasNearbyAnchor && !isAddMode}
        options={RADIUS_OPTIONS.map((value) => ({
          value,
          label: radiusLabel(value),
          isSelected: selectedRadius === value,
        }))}
        onSelect={onSelectRadius}
      />
      <MapCategoryRail
        showMemo
        className={styles.categoryRail}
        selectedCategories={selectedCategories}
        counts={categoryCounts}
        onToggle={onToggleCategory}
      />
    </>
    <div className={styles.locationControls}>
      <MapLocationStatus
        className={styles.locationToast}
        status={locationStatus}
        failure={locationFailure}
        canRetry={canRetryLocation}
        permission={locationPermission}
        onRetry={onMoveToCurrentLocation}
      />
      <MapCurrentLocationButton isLocating={locationStatus === 'locating'} onClick={onMoveToCurrentLocation} />
    </div>
    {!isAddMode && (
      <div className={styles.addPropertyAction}>
        <PageAction placement="inline" onClick={onEnterAddMode} aria-label="지도에서 매물 추가">
          매물 추가
        </PageAction>
      </div>
    )}
  </>
);

export default MapControls;
