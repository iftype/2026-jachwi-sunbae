import { useCallback, useState } from 'react';

import useAddressSearch from '@/features/map/api/useAddressSearch';

/** 페이지는 검색 화면의 열기·닫기만 맡고 주소 조회는 지도 기능에서 관리한다. */
const useMapSearch = () => {
  const [searchOpen, setSearchOpen] = useState(false);
  const search = useAddressSearch();
  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    search.clear();
  }, [search.clear]);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  return {
    searchOpen,
    openSearch,
    searchQuery: search.query,
    changeQuery: search.changeQuery,
    searchResults: search.results,
    searchStatus: search.status,
    submitSearch: search.submit,
    closeSearch,
  };
};
export default useMapSearch;
