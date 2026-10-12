import type { AddressSearchStatus } from '@/features/map/model/AddressSearch';
import type { MapAddress } from '@/features/map/model/Map';
import AddressSearchResults from '@/features/map/ui/address-search-results/AddressSearchResults';
import Icon from '@/shared/ui/icon/Icon';
import SearchField from '@/shared/ui/search-field/SearchField';

import styles from './MapAddressSearch.module.css';

type MapAddressSearchProps = {
  isOpen: boolean;
  locationLabel: string;
  query: string;
  results: MapAddress[];
  status: AddressSearchStatus;
  onOpen: () => void;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  onSelect: (address: MapAddress) => void;
};

const MapAddressSearch = ({
  isOpen,
  locationLabel,
  query,
  results,
  status,
  onOpen,
  onClose,
  onQueryChange,
  onSubmit,
  onSelect,
}: MapAddressSearchProps) => (
  <>
    <div className={styles.topSearchBar}>
      {isOpen ? (
        <SearchField
          className={styles.activeSearchField}
          label="주소 검색"
          placeholder="도로명 또는 지번 주소 검색"
          value={query}
          shape="pill"
          autoFocus
          showSubmitButton={false}
          onBack={onClose}
          onValueChange={onQueryChange}
          onSubmit={onSubmit}
        />
      ) : (
        <button type="button" className={styles.searchTrigger} aria-label="주소 또는 위치 검색" onClick={onOpen}>
          <Icon name="search" size={18} />
          <span className={styles.searchPrompt}>{locationLabel}</span>
        </button>
      )}
    </div>

    {isOpen && (
      <section className={styles.searchPageView} aria-label="주소 검색 화면">
        <AddressSearchResults results={results} status={status} onSelect={onSelect} />
      </section>
    )}
  </>
);

export default MapAddressSearch;
