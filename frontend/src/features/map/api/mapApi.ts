import { apiRequest } from '@/features/auth/api/apiClient';
import { readArray, readInteger, readRecord, readString } from '@/shared/api/responseParsers';
import type { PublicConfig } from '@/shared/config/publicConfigTypes';

import type { MapAddress, NearbyCategory, NearbyPlace, NearbyResult } from '../model/Map';

const readCoordinate = (record: Record<string, unknown>, key: string): number => {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('지도 좌표 응답이 올바르지 않습니다.');
  return value;
};

const readNullableText = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
};

const parseAddress = (value: unknown): MapAddress => {
  const record = readRecord(value);
  const roadAddress = readNullableText(record, 'roadAddress');
  const jibunAddress = readNullableText(record, 'jibunAddress');
  return {
    address: roadAddress ?? jibunAddress,
    roadAddress,
    jibunAddress,
    latitude: readCoordinate(record, 'latitude'),
    longitude: readCoordinate(record, 'longitude'),
  };
};

const isMapCategory = (value: string): value is NearbyCategory =>
  value === 'HOSPITAL' || value === 'SCHOOL' || value === 'CONVENIENCE' || value === 'AGENCY';

const parseNearbyPlace = (value: unknown): NearbyPlace => {
  const record = readRecord(value);
  const category = readString(record, 'category');
  if (!isMapCategory(category)) throw new Error('주변 시설 카테고리 응답이 올바르지 않습니다.');
  return {
    providerPlaceId: readString(record, 'providerPlaceId'),
    name: readString(record, 'name'),
    category,
    address: readString(record, 'address', { allowEmpty: true }),
    latitude: readCoordinate(record, 'latitude'),
    longitude: readCoordinate(record, 'longitude'),
    distanceMeters: readInteger(record, 'distanceMeters'),
  };
};

const parseNearby = (value: unknown): NearbyResult => {
  const record = readRecord(value);
  const center = readRecord(record.center);
  const countsRecord = readRecord(record.counts);
  const radius = readInteger(record, 'radius');
  if (radius !== 500 && radius !== 1000 && radius !== 2000) throw new Error('지도 반경 응답이 올바르지 않습니다.');
  const categories: NearbyCategory[] = ['HOSPITAL', 'SCHOOL', 'CONVENIENCE', 'AGENCY'];
  const counts = Object.fromEntries(
    categories.map((category) => [category, readInteger(countsRecord, category)]),
  ) as Record<NearbyCategory, number>;
  return {
    center: { latitude: readCoordinate(center, 'latitude'), longitude: readCoordinate(center, 'longitude') },
    radius,
    counts,
    places: readArray(record, 'places').map(parseNearbyPlace),
  };
};

export const searchAddress = (config: PublicConfig, query: string, signal?: AbortSignal): Promise<MapAddress[]> =>
  apiRequest({
    config,
    path: `/api/maps/geocode?query=${encodeURIComponent(query)}`,
    signal,
    parseData: (value) => {
      if (!Array.isArray(value)) throw new Error('주소 검색 응답이 올바르지 않습니다.');
      return value.map(parseAddress);
    },
  });

/** 동네 찾기와 동네 검색에서 건물명이나 장소 이름을 네이버로 바로 검색한다. */
export const searchAddressWithNaver = (
  config: PublicConfig,
  query: string,
  signal?: AbortSignal,
): Promise<MapAddress[]> =>
  apiRequest({
    config,
    path: `/api/maps/search?query=${encodeURIComponent(query)}`,
    signal,
    parseData: (value) => {
      if (!Array.isArray(value)) throw new Error('주소 검색 응답이 올바르지 않습니다.');
      return value.map(parseAddress);
    },
  });

const isSameAddress = (a: MapAddress, b: MapAddress) =>
  (a.roadAddress !== null && a.roadAddress === b.roadAddress) ||
  (a.latitude === b.latitude && a.longitude === b.longitude);

/**
 * 장소명과 지역명은 search, 정확한 도로명 주소는 geocode가 잘 찾는다. 둘을 함께 불러 합친다.
 * 한쪽만 실패하면 성공한 쪽 결과를 쓰고, 둘 다 실패했을 때만 오류로 던진다.
 */
export const searchPlacesAndAddresses = async (
  config: PublicConfig,
  query: string,
  signal?: AbortSignal,
): Promise<MapAddress[]> => {
  const [places, addresses] = await Promise.allSettled([
    searchAddressWithNaver(config, query, signal),
    searchAddress(config, query, signal),
  ]);
  if (places.status === 'rejected' && addresses.status === 'rejected') throw places.reason;
  const placeList = places.status === 'fulfilled' ? places.value : [];
  const addressList = addresses.status === 'fulfilled' ? addresses.value : [];
  return [...placeList, ...addressList.filter((item) => !placeList.some((place) => isSameAddress(place, item)))];
};

export const reverseGeocode = (config: PublicConfig, latitude: number, longitude: number): Promise<MapAddress> =>
  apiRequest({
    config,
    path: `/api/maps/reverse-geocode?latitude=${latitude}&longitude=${longitude}`,
    parseData: parseAddress,
  });

export const fetchNearby = (
  config: PublicConfig,
  latitude: number,
  longitude: number,
  radius: 500 | 1000 | 2000,
  categories: NearbyCategory[],
  signal?: AbortSignal,
): Promise<NearbyResult> =>
  apiRequest({
    config,
    path: `/api/maps/nearby?latitude=${latitude}&longitude=${longitude}&radius=${radius}&categories=${categories.join(',')}`,
    signal,
    parseData: parseNearby,
  });
