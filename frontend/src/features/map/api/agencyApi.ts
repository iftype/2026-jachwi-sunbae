import { apiRequest } from '@/features/auth/api/apiClient';
import { readArray, readInteger, readNullableString, readRecord, readString } from '@/shared/api/responseParsers';
import type { PublicConfig } from '@/shared/config/publicConfigTypes';

import type { NearbyAgenciesResult, NearbyAgency } from '../model/Map';

const coordinate = (record: Record<string, unknown>, key: string): number => {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('중개업소 좌표가 올바르지 않습니다.');
  return value;
};

/** 외부 링크로 바로 여는 값이라 http(s) 주소만 받는다. */
const readPlaceUrl = (record: Record<string, unknown>): string | null => {
  const value = readNullableString(record, 'placeUrl');
  if (value === null) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error();
    return url.toString();
  } catch {
    throw new Error('중개업소 상세 페이지 주소가 올바르지 않습니다.');
  }
};

const parseAgency = (value: unknown): NearbyAgency => {
  const record = readRecord(value);
  return {
    providerPlaceId: readString(record, 'providerPlaceId'),
    name: readString(record, 'name'),
    address: readString(record, 'address', { allowEmpty: true }),
    latitude: coordinate(record, 'latitude'),
    longitude: coordinate(record, 'longitude'),
    distanceMeters: readInteger(record, 'distanceMeters'),
    phone: readNullableString(record, 'phone'),
    placeUrl: readPlaceUrl(record),
  };
};

/** 반경 안의 공인중개사를 가까운 순으로 조회한다. 다른 지도 API처럼 회원(익명 포함) 토큰을 보낸다. */
export const fetchNearbyAgencies = (
  config: PublicConfig,
  latitude: number,
  longitude: number,
  radius: 500 | 1000 | 2000,
  signal?: AbortSignal,
): Promise<NearbyAgenciesResult> =>
  apiRequest({
    config,
    signal,
    path: `/api/maps/agencies?${new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), radius: String(radius) })}`,
    parseData: (value) => {
      const data = readRecord(value);
      const center = readRecord(data.center);
      if (readInteger(data, 'radius') !== radius) throw new Error('중개업소 반경이 올바르지 않습니다.');
      const agencies = readArray(data, 'agencies').map(parseAgency);
      const count = readInteger(data, 'count');
      if (count !== agencies.length || new Set(agencies.map((agency) => agency.providerPlaceId)).size !== count)
        throw new Error('중개업소 집계가 올바르지 않습니다.');
      return {
        center: { latitude: coordinate(center, 'latitude'), longitude: coordinate(center, 'longitude') },
        radius,
        count,
        agencies,
      };
    },
  });
