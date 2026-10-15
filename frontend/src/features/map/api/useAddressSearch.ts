import { useCallback, useEffect, useRef, useState } from 'react';

import { usePublicConfig } from '@/shared/config/PublicConfigContext';

import type { AddressSearchStatus } from '../model/AddressSearch';
import type { MapAddress } from '../model/Map';
import { searchAddress } from './mapApi';

/** 검색 요청과 화면 표현을 분리한다. 입력 변경·닫기 이후의 오래된 응답은 반영하지 않는다. */
const useAddressSearch = () => {
  const config = usePublicConfig();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MapAddress[]>([]);
  const [status, setStatus] = useState<AddressSearchStatus>('idle');
  const controllerRef = useRef<AbortController | null>(null);
  const requestRef = useRef(0);

  const cancelRequest = useCallback(() => {
    requestRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);
  useEffect(() => cancelRequest, [cancelRequest]);

  const changeQuery = useCallback(
    (value: string) => {
      cancelRequest();
      setQuery(value.trim() === '' ? '' : value);
      setResults([]);
      setStatus('idle');
    },
    [cancelRequest],
  );
  const clear = useCallback(() => changeQuery(''), [changeQuery]);

  const submit = useCallback(async () => {
    if (query.trim() === '') return;
    cancelRequest();
    const requestId = requestRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    setResults([]);
    setStatus('loading');
    try {
      const found = await searchAddress(config, query.trim(), controller.signal);
      if (requestId !== requestRef.current) return;
      setResults(found);
      setStatus('success');
    } catch {
      if (requestId !== requestRef.current) return;
      setStatus('error');
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, [cancelRequest, config, query]);
  return { query, results, status, changeQuery, clear, submit };
};

export default useAddressSearch;
