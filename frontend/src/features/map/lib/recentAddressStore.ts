/**
 * 최근에 찾은 주소를 기기에만 기억한다. 서버로 보내지 않는다.
 * 기록 지도의 주소 검색 화면이 입력 전에 보여 주고, 같은 주소는 맨 위로 올린다.
 */
import type { MapAddress } from '@/features/map/model/Map';

import { readMapAddress } from './mapAddress';

const STORAGE_KEY = 'jachwi-sunbae:recent-addresses';
export const RECENT_ADDRESS_LIMIT = 8;

export const recentAddressLabel = (address: MapAddress) =>
  address.roadAddress ?? address.jibunAddress ?? address.address ?? '';

export const readRecentAddresses = (): MapAddress[] => {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.map(readMapAddress).filter((address): address is MapAddress => address !== null);
  } catch {
    // 저장소를 막아 둔 브라우저나 깨진 값은 기록이 없는 것으로 본다.
    return [];
  }
};

const write = (addresses: MapAddress[]): MapAddress[] => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(addresses));
  } catch {
    /* 기억하지 못해도 검색은 그대로 쓴다. */
  }
  return addresses;
};

/** 고른 주소를 맨 위에 두고 같은 주소는 하나만 남긴다. 최대 `RECENT_ADDRESS_LIMIT`개만 둔다. */
export const addRecentAddress = (address: MapAddress): MapAddress[] => {
  const label = recentAddressLabel(address);
  const rest = readRecentAddresses().filter((saved) => recentAddressLabel(saved) !== label);
  return write([address, ...rest].slice(0, RECENT_ADDRESS_LIMIT));
};

export const removeRecentAddress = (address: MapAddress): MapAddress[] => {
  const label = recentAddressLabel(address);
  return write(readRecentAddresses().filter((saved) => recentAddressLabel(saved) !== label));
};

export const clearRecentAddresses = (): MapAddress[] => write([]);
