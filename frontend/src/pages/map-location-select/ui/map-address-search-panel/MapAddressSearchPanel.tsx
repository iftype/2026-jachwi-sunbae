import { useEffect } from 'react';

import useAddressSearch from '@/features/map/api/useAddressSearch';
import type { MapAddress } from '@/features/map/model/Map';
import AddressSearchResults from '@/features/map/ui/address-search-results/AddressSearchResults';
import Icon from '@/shared/ui/icon/Icon';
import SearchField from '@/shared/ui/search-field/SearchField';

import styles from './MapAddressSearchPanel.module.css';

type MapAddressSearchPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (address: MapAddress) => void;
};

const MapAddressSearchPanel = ({ isOpen, onClose, onSelect }: MapAddressSearchPanelProps) => {
  const { query, results, status, changeQuery, submit, clear } = useAddressSearch();
  useEffect(() => {
    if (!isOpen) clear();
  }, [isOpen, clear]);
  if (!isOpen) return null;
  return (
    <section className={styles.panel} aria-label="주소로 지도 위치 찾기">
      <div className={styles.heading}>
        <strong>주소로 찾기</strong>
        <button type="button" aria-label="주소 검색 닫기" onClick={onClose}>
          <Icon name="close" size={18} />
        </button>
      </div>
      <SearchField
        label="주소 검색"
        value={query}
        placeholder="도로명 또는 지번 주소"
        onValueChange={changeQuery}
        onSubmit={() => void submit()}
      />
      <AddressSearchResults
        results={results}
        status={status}
        onSelect={(address) => {
          onSelect(address);
          onClose();
        }}
      />
    </section>
  );
};
export default MapAddressSearchPanel;
