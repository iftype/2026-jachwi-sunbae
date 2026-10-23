import { apiRequest } from '@/features/auth/api/apiClient';
import { readArray, readInteger, readRecord, readString } from '@/shared/api/responseParsers';
import type { PublicConfig } from '@/shared/config/publicConfigTypes';

export type CommuteRoute = {
  totalMinutes: number;
  transferCount: number;
  legs: {
    type: 'BUS' | 'SUBWAY' | 'WALK';
    routeName: string | null;
    minutes: number;
    waitMinutes: number;
    points: { stopId: string | null; name: string; latitude: number; longitude: number }[];
  }[];
};

export const fetchCommuteRoute = (
  config: PublicConfig,
  destination: { latitude: number; longitude: number },
  stopId: string,
  maxMinutes: number,
  maxTransfers: number,
  signal?: AbortSignal,
): Promise<CommuteRoute> =>
  apiRequest({
    config,
    signal,
    path: `/api/commute-areas/route?${new URLSearchParams({ latitude: String(destination.latitude), longitude: String(destination.longitude), stopId, maxMinutes: String(maxMinutes), maxTransfers: String(maxTransfers) })}`,
    parseData: (value) => {
      const data = readRecord(value);
      const legs = readArray(data, 'legs').map((item) => {
        const leg = readRecord(item);
        const rawType = readString(leg, 'type');
        if (rawType !== 'BUS' && rawType !== 'SUBWAY' && rawType !== 'WALK')
          throw new Error('경로 구간 형식이 올바르지 않습니다.');
        const type: CommuteRoute['legs'][number]['type'] = rawType;
        const routeName = leg.routeName;
        if (routeName !== null && typeof routeName !== 'string') throw new Error('노선명이 올바르지 않습니다.');
        const points = readArray(leg, 'points').map((item) => {
          const point = readRecord(item);
          const latitude = point.latitude;
          const longitude = point.longitude;
          if (
            typeof latitude !== 'number' ||
            !Number.isFinite(latitude) ||
            Math.abs(latitude) > 90 ||
            typeof longitude !== 'number' ||
            !Number.isFinite(longitude) ||
            Math.abs(longitude) > 180
          )
            throw new Error('경로 좌표가 올바르지 않습니다.');
          const stopId = point.stopId;
          if (stopId !== null && typeof stopId !== 'string') throw new Error('정류장 ID가 올바르지 않습니다.');
          return { stopId, name: readString(point, 'name'), latitude, longitude };
        });
        if (points.length < 2) throw new Error('경로 구간에 지점이 부족합니다.');
        return {
          type,
          routeName,
          minutes: readInteger(leg, 'minutes'),
          waitMinutes: readInteger(leg, 'waitMinutes'),
          points,
        };
      });
      return {
        totalMinutes: readInteger(data, 'totalMinutes'),
        transferCount: readInteger(data, 'transferCount'),
        legs,
      };
    },
  });
