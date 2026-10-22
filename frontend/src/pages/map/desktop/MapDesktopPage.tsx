import { useNavigate, useParams } from 'react-router-dom';

import PropertyDetailPage from '@/pages/property-detail/PropertyDetailPage';
import { parsePositiveId } from '@/features/property/lib/propertyFormat';

import useMapPage from '../hooks/useMapPage';
import MapAddressSearch from '../ui/map-address-search/MapAddressSearch';
import MapPropertyPanel from '../ui/map-property-panel/MapPropertyPanel';
import MapStage from '../ui/map-stage/MapStage';

import shared from '../MapPage.module.css';
import styles from './MapDesktopPage.module.css';

/**
 * 데스크탑 인프라 지도. 검색창은 공용 데스크탑 헤더로 옮겨 그리고,
 * 바텀시트 대신 왼쪽 칸에 매물 목록을 늘 펼쳐 둔 채 오른쪽에 지도를 둔다.
 * 목록에서 매물을 누르면(`/map/:propertyId`) 기록 화면처럼 지도를 떠나지 않고 왼쪽 칸에서 상세를 연다.
 */
const MapDesktopPage = () => {
  const map = useMapPage();
  const { search, mapLocation } = map;
  const navigate = useNavigate();
  const openedPropertyId = parsePositiveId(useParams().propertyId);

  return (
    <main className={`${shared.page} ${styles.root}`}>
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
      {openedPropertyId !== null ? (
        <aside className={`${styles.panel} ${styles.detailPanel}`} aria-label="선택한 매물 상세">
          <PropertyDetailPage
            key={openedPropertyId}
            panel={{ propertyId: openedPropertyId, onClose: () => navigate('/map') }}
          />
        </aside>
      ) : (
        <MapPropertyPanel
          className={styles.panel}
          isLoading={map.isLoading}
          isError={map.isError}
          onRetry={() => void map.retry()}
          properties={map.listProperties}
          selectedPropertyId={map.selectedPropertyId}
          returnState={{ mapViewKey: map.locationKey }}
        />
      )}
      <MapStage map={map} className={styles.mapStage} />
    </main>
  );
};

export default MapDesktopPage;
