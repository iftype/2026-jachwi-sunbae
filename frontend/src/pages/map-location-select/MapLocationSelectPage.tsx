import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import type { MapAddress } from '@/features/map/model/Map';
import MapCanvas from '@/features/map/ui/map-canvas/MapCanvas';
import type { PropertyInputDto } from '@/features/property/api/dtos/PropertyDto';
import { RECORDS_PATH } from '@/shared/lib/navigation/appPaths';
import TopNavigation from '@/shared/ui/top-navigation/TopNavigation';

import useLocationConfirm from './hooks/useLocationConfirm';
import useLocationSelection from './hooks/useLocationSelection';
import usePropertyMarkers from './hooks/usePropertyMarkers';
import LocationAddressSheet from './ui/location-address-sheet/LocationAddressSheet';
import LocationMapControls from './ui/location-map-controls/LocationMapControls';
import MapAddressSearchPanel from './ui/map-address-search-panel/MapAddressSearchPanel';

import styles from './MapLocationSelectPage.module.css';

type RouteState = { returnTo?: string; initialLocation?: MapAddress; registrationDraft?: PropertyInputDto };

const MapLocationSelectPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state as RouteState | null) ?? {};
  const returnTo = routeState.returnTo ?? '/properties/new';
  const launchedFromForm = routeState.returnTo !== undefined;
  const { registrationDraft, initialLocation } = routeState;
  const knownLocationLevel = initialLocation === undefined ? 5 : 3;
  const [searchOpen, setSearchOpen] = useState(false);
  const selection = useLocationSelection(initialLocation);
  const { confirm, isCreating, hasCreateError } = useLocationConfirm({ returnTo, registrationDraft });
  const propertyMarkers = usePropertyMarkers();

  const moveToCurrentLocation = async () => {
    const moved = await selection.moveToCurrentLocation();
    if (!moved) setSearchOpen(true);
  };

  return (
    <main className={styles.page}>
      <TopNavigation
        className={styles.mapNavigation}
        title="지도에서 위치 확인"
        {...(registrationDraft === undefined
          ? { backTo: launchedFromForm ? returnTo : RECORDS_PATH }
          : { onBack: () => navigate(returnTo, { replace: true, state: { registrationDraft } }) })}
        backLabel="이전 화면으로 돌아가기"
        meta="13-2"
      />
      <section className={styles.mapStage} aria-label="매물 위치 선택 지도">
        <MapCanvas
          center={selection.selected}
          markers={propertyMarkers}
          level={knownLocationLevel}
          interactive
          showCenterPin
          onSelectLocation={(latitude, longitude) => void selection.selectCoordinates(latitude, longitude)}
          onCenterChange={selection.handleCenterChange}
        />
        <MapAddressSearchPanel
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
          onSelect={selection.applySearchedAddress}
        />
        <LocationMapControls
          isLocating={selection.status === 'locating'}
          onOpenSearch={() => setSearchOpen(true)}
          onMoveToCurrentLocation={() => void moveToCurrentLocation()}
        />
        <LocationAddressSheet
          selected={selection.selected}
          status={selection.status}
          isEditing={returnTo.endsWith('/edit')}
          isCreating={isCreating}
          hasCreateError={hasCreateError}
          onOpenSearch={() => setSearchOpen(true)}
          onConfirm={() => confirm(selection.selected)}
        />
      </section>
    </main>
  );
};

export default MapLocationSelectPage;
