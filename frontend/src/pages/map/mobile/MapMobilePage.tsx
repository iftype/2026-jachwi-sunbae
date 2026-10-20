import useMapPage from '../hooks/useMapPage';
import MapAddressSearch from '../ui/map-address-search/MapAddressSearch';
import MapPropertySheet from '../ui/map-property-sheet/MapPropertySheet';
import MapStage from '../ui/map-stage/MapStage';

import shared from '../MapPage.module.css';

/** 휴대폰·태블릿 인프라 지도. 지도 위 검색창과 끌어 올리는 매물 바텀시트를 둔다. */
const MapMobilePage = () => {
  const map = useMapPage();
  const { search, mapLocation, sheet } = map;

  return (
    <main className={shared.page}>
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
        onSelect={map.selectSearchedAddress}
      />
      <MapStage map={map}>
        <MapPropertySheet
          sheetRef={sheet.sheetRef}
          stage={sheet.sheetStage}
          isDragging={sheet.isDragging}
          isLoading={map.isLoading}
          isError={map.isError}
          onRetry={() => void map.retry()}
          properties={map.listProperties}
          selectedPropertyId={map.selectedPropertyId}
          onDragStart={sheet.handleDragStart}
          onDragMove={sheet.handleDragMove}
          onDragEnd={sheet.handleDragEnd}
          onDragCancel={sheet.handleDragCancel}
          onToggle={sheet.toggleSheet}
          returnState={{ mapViewKey: map.locationKey }}
        />
      </MapStage>
    </main>
  );
};

export default MapMobilePage;
