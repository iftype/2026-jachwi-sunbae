import type { MapAddress } from '@/features/map/model/Map';

import { readMapAddress } from './mapAddress';

/** 주소 검색 화면이 기록 지도로 돌아가며 라우터 상태에 실어 보내는 값. */
export type SearchedAddressState = { searchedAddress: MapAddress };

export const readSearchedAddress = (state: unknown): MapAddress | null => {
  if (typeof state !== 'object' || state === null || !('searchedAddress' in state)) return null;
  return readMapAddress(state.searchedAddress);
};
