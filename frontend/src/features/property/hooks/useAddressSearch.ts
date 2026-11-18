import { useCallback, useRef, useState } from 'react';

import { searchPlacesAndAddresses } from '@/features/map/api/mapApi';
import type { MapAddress } from '@/features/map/model/Map';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';
import { trackPostHogEvent } from '@/shared/lib/analytics/posthog';

export type AddressSearchStatus = 'idle' | 'loading' | 'error';

const formatAddress = (address: MapAddress) => address.roadAddress ?? address.jibunAddress ?? address.address ?? '';

const useAddressSearch = () => {
  const config = usePublicConfig();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MapAddress[]>([]);
  const [status, setStatus] = useState<AddressSearchStatus>('idle');
  // 입력할 때마다 검색하면 앞선 요청이 늦게 올 수 있다. 마지막 요청의 응답만 쓴다.
  const sequenceRef = useRef(0);

  const changeQuery = (value: string) => {
    ++sequenceRef.current;
    setQuery(value);
    setResults([]);
    setStatus('idle');
  };

  /** 현재 선택된 주소를 검색창의 초기값으로만 채운다. 사용자가 입력한 검색어는 덮어쓰지 않는다. */
  const setInitialQuery = useCallback((value: string) => {
    setQuery((current) => (current === '' ? value : current));
  }, []);

  const clear = () => changeQuery('');

  const submit = async () => {
    if (query.trim() === '') return;
    const sequence = ++sequenceRef.current;
    trackPostHogEvent('address_search_started');
    setStatus('loading');
    try {
      const found = await searchPlacesAndAddresses(config, query.trim());
      if (sequenceRef.current !== sequence) return;
      setResults(found);
      setStatus('idle');
    } catch {
      if (sequenceRef.current !== sequence) return;
      trackPostHogEvent('address_search_failed', { error_kind: 'server' });
      setResults([]);
      setStatus('error');
    }
  };

  /** 고른 결과를 검색어로 남기고 목록을 닫는다. */
  const pick = (result: MapAddress) => {
    ++sequenceRef.current;
    setResults([]);
    setQuery(formatAddress(result));
  };

  return { query, results, status, setStatus, changeQuery, setInitialQuery, clear, submit, pick };
};

export default useAddressSearch;
