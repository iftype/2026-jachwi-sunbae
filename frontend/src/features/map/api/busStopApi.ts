import { apiRequest } from '@/features/auth/api/apiClient';
import { readArray, readInteger, readRecord, readString } from '@/shared/api/responseParsers';
import type { PublicConfig } from '@/shared/config/publicConfigTypes';

const coordinate = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('정류장 좌표가 올바르지 않습니다.');
  return value;
};
export const fetchBusStops = (
  config: PublicConfig,
  latitude: number,
  longitude: number,
  radius: 500 | 1000 | 2000,
  signal?: AbortSignal,
) =>
  apiRequest({
    config,
    signal,
    path: `/api/maps/bus-stops?${new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), radius: String(radius) })}`,
    parseData: (value) => {
      const data = readRecord(value);
      const center = readRecord(data.center);
      const responseRadius = readInteger(data, 'radius');
      if (responseRadius !== radius) throw new Error('정류장 반경이 올바르지 않습니다.');
      const busStops = readArray(data, 'busStops').map((value) => {
        const stop = readRecord(value);
        const distanceMeters = readInteger(stop, 'distanceMeters');
        if (distanceMeters < 0) throw new Error('정류장 거리가 올바르지 않습니다.');
        return {
          nodeId: readString(stop, 'nodeId'),
          name: readString(stop, 'name'),
          latitude: coordinate(stop, 'latitude'),
          longitude: coordinate(stop, 'longitude'),
          distanceMeters,
        };
      });
      const count = readInteger(data, 'count');
      if (count !== busStops.length || new Set(busStops.map((stop) => stop.nodeId)).size !== count)
        throw new Error('정류장 집계가 올바르지 않습니다.');
      return {
        center: { latitude: coordinate(center, 'latitude'), longitude: coordinate(center, 'longitude') },
        radius,
        count,
        busStops,
      };
    },
  });
