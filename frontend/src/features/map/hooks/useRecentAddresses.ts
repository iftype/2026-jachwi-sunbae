import { useMemo, useSyncExternalStore } from 'react';

import { parseRecentAddresses, readRecentAddressesRaw, subscribeRecentAddresses } from '../lib/recentAddressStore';

const serverSnapshot = () => '';

/** 기기에 저장된 최근 검색. 한 검색창에서 지우면 다른 검색창과 다른 탭에도 바로 반영된다. */
const useRecentAddresses = () => {
  const raw = useSyncExternalStore(subscribeRecentAddresses, readRecentAddressesRaw, serverSnapshot);
  return useMemo(() => parseRecentAddresses(raw), [raw]);
};

export default useRecentAddresses;
