import { Link } from 'react-router-dom';

import type { AddressSearchStatus } from '@/features/map/model/AddressSearch';
import type { MapAddress } from '@/features/map/model/Map';
import AddressSearchResults from '@/features/map/ui/address-search-results/AddressSearchResults';
import { HOME_PATH } from '@/shared/lib/navigation/appPaths';
import DesktopHeaderSlot, { useHasDesktopHeaderSlot } from '@/shared/ui/desktop-header/DesktopHeaderSlot';
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
}: MapAddressSearchProps) => {
  // 데스크탑은 검색창을 지도 위 대신 공용 헤더 가운데에 둔다.
  const inHeader = useHasDesktopHeaderSlot();

  return (
    <>
      <DesktopHeaderSlot>
        <div className={inHeader ? styles.headerSearchBar : styles.topSearchBar}>
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
            <>
              {/* 지도 위(휴대폰·태블릿)에서는 기록 화면처럼 흰 원형 버튼으로 홈에 돌아간다. 헤더 안에서는 로고가 대신한다. */}
              {!inHeader && (
                <Link className={styles.back} to={HOME_PATH} aria-label="홈으로 돌아가기">
                  <Icon name="chevron-left" size={24} />
                </Link>
              )}
              <button type="button" className={styles.searchTrigger} aria-label="주소 또는 위치 검색" onClick={onOpen}>
                <Icon name="search" size={18} />
                <span className={styles.searchPrompt}>{locationLabel}</span>
              </button>
            </>
          )}
        </div>
      </DesktopHeaderSlot>

      {isOpen && (
        <section className={styles.searchPageView} data-in-header={inHeader || undefined} aria-label="주소 검색 화면">
          <AddressSearchResults results={results} status={status} onSelect={onSelect} />
        </section>
      )}
    </>
  );
};

export default MapAddressSearch;
