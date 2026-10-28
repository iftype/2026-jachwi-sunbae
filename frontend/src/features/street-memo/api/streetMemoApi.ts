import { apiRequest } from '@/features/auth/api/apiClient';
import type { MapBounds } from '@/features/map/model/Map';
import { readBoolean, readInteger, readRecord, readString } from '@/shared/api/responseParsers';
import type { PublicConfig } from '@/shared/config/publicConfigTypes';

import type { StreetMemo, StreetMemoDraft, StreetMemoPreference } from '../model/StreetMemo';

const coordinate = (record: Record<string, unknown>, key: string): number => {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('거리 메모 좌표가 올바르지 않습니다.');
  return value;
};

const readPreference = (record: Record<string, unknown>): StreetMemoPreference => {
  const value = readString(record, 'preference');
  if (value !== 'LIKE' && value !== 'DISLIKE') throw new Error('거리 메모 선호값이 올바르지 않습니다.');
  return value;
};

const parseStreetMemo = (value: unknown): StreetMemo => {
  const record = readRecord(value);
  return {
    id: readInteger(record, 'streetMemoId', 1),
    latitude: coordinate(record, 'latitude'),
    longitude: coordinate(record, 'longitude'),
    // 입력한 공백과 줄바꿈을 그대로 보여준다.
    memo: readString(record, 'memo', { allowEmpty: true }),
    preference: readPreference(record),
    isMine: readBoolean(record, 'isMine'),
  };
};

/** 지도에 보이는 사각형 안의 메모를 모든 회원 것까지 조회한다. 경계 위의 메모도 포함한다. */
export const fetchStreetMemos = (
  config: PublicConfig,
  bounds: MapBounds,
  signal?: AbortSignal,
): Promise<StreetMemo[]> =>
  apiRequest({
    config,
    signal,
    path: `/api/street-memos?${new URLSearchParams({
      minLatitude: String(bounds.south),
      maxLatitude: String(bounds.north),
      minLongitude: String(bounds.west),
      maxLongitude: String(bounds.east),
    })}`,
    parseData: (value) => {
      if (!Array.isArray(value)) throw new Error('거리 메모 목록이 올바르지 않습니다.');
      return value.map(parseStreetMemo);
    },
  });

export const createStreetMemo = (config: PublicConfig, draft: StreetMemoDraft): Promise<StreetMemo> =>
  apiRequest({
    config,
    path: '/api/street-memos',
    method: 'POST',
    body: draft,
    parseData: parseStreetMemo,
  });

/** 본인 메모만 지울 수 있다. 남의 메모·이미 지운 메모는 서버가 404로 답한다. */
export const removeStreetMemo = (config: PublicConfig, streetMemoId: number): Promise<void> =>
  apiRequest({
    config,
    path: `/api/street-memos/${streetMemoId}`,
    method: 'DELETE',
    parseData: (value) => {
      if (value !== undefined) throw new Error('거리 메모 삭제 응답이 올바르지 않습니다.');
    },
  });
