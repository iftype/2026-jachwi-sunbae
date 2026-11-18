import { ApiError } from '@/features/auth/api/apiClient';

import type { MapAddress } from '../model/Map';

/**
 * 주소가 없는 매물과 위치의 주소 칸에 빈칸 대신 흐리게 보이는 글.
 * 역지오코딩이 주소를 찾지 못했거나(바다, 산, 공터 등) 주소 조회가 실패한 자리도 매물은 좌표만으로 등록한다.
 */
export const UNSUPPORTED_ADDRESS_MESSAGE = '지원하지 않는 주소입니다';

/** 서버가 그 좌표의 주소를 찾지 못했다고 답할 때 쓰는 오류 코드. */
const ADDRESS_NOT_FOUND_CODE = 'MAP_ADDRESS_NOT_FOUND';

/** 도로명이나 지번 주소 중 하나라도 있는지. 응답은 성공이어도 둘 다 비어 올 수 있다. */
export const hasAddress = (address: MapAddress): boolean =>
  address.roadAddress !== null || address.jibunAddress !== null || address.address !== null;

/** 역지오코딩 실패가 "그 자리에 주소가 없다"는 뜻인지. 네트워크 오류 같은 일시 실패와 나눈다. */
export const isAddressNotFound = (error: unknown): boolean =>
  error instanceof ApiError && error.code === ADDRESS_NOT_FOUND_CODE;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isCoordinate = (value: unknown, limit: number): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;
const isText = (value: unknown): value is string | null => value === null || typeof value === 'string';

export const readMapAddress = (value: unknown): MapAddress | null => {
  if (!isRecord(value)) return null;
  const { address, roadAddress, jibunAddress, latitude, longitude } = value;
  if (!isCoordinate(latitude, 90) || !isCoordinate(longitude, 180)) return null;
  if (!isText(address) || !isText(roadAddress) || !isText(jibunAddress)) return null;
  return { address, roadAddress, jibunAddress, latitude, longitude };
};
