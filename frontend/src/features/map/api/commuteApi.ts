import { apiRequest } from '@/features/auth/api/apiClient';
import {
  readArray,
  readInteger,
  readNullableInteger,
  readNullableString,
  readRecord,
  readString,
} from '@/shared/api/responseParsers';
import type { PublicConfig } from '@/shared/config/publicConfigTypes';

import type { MapRegion } from '../model/MapCanvas';

type Coordinate = { latitude: number; longitude: number };
export type CommuteArea = {
  adminDongCode: string;
  name: string;
  fullName: string;
  commuteMinutes: number;
  center: Coordinate;
  polygons: Coordinate[][][];
  simplifiedPolygons?: MapRegion['simplifiedPolygons'];
  stations: CommuteStation[];
  rent: CommuteAreaRent | null;
};
/** 관할 법정동 월세 거래를 합친 동네 시세. 거래가 5건보다 적은 동네는 서버가 금액을 비워 보낸다. */
export type CommuteAreaRent = {
  monthlyRentKrw: number;
  depositKrw: number;
  transactionCount: number;
  legalDongNames: string[];
};
export type CommuteStation = Coordinate & {
  stopId: string;
  stopName: string;
  travelMinutes: number;
  direction: string | null;
};
export type CommuteResult = {
  maxMinutes: number;
  areaCount: number;
  /** 시세를 낸 거래 기간. 시세가 하나도 없으면 null이다. */
  rentPeriod: { startDate: string; endDate: string } | null;
  areas: CommuteArea[];
};

const coordinate = (value: unknown): Coordinate => {
  const record = readRecord(value);
  const { latitude, longitude } = record;
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    throw new Error('지도 좌표 응답이 올바르지 않습니다.');
  return { latitude, longitude };
};
const parsePolygon = (value: unknown): Coordinate[][] => {
  if (!Array.isArray(value) || !value.length) throw new Error('행정동 경계가 비어 있습니다.');
  return value.map((ring: unknown) => {
    if (!Array.isArray(ring) || ring.length < 4) throw new Error('경계 링이 올바르지 않습니다.');
    const points = ring.map((point: unknown) => {
      if (!Array.isArray(point) || point.length < 2) throw new Error('경계 좌표가 올바르지 않습니다.');
      return coordinate({ longitude: point[0], latitude: point[1] });
    });
    const first = points[0];
    const last = points[points.length - 1];
    if (first.latitude !== last.latitude || first.longitude !== last.longitude)
      throw new Error('경계 링이 닫혀 있지 않습니다.');
    return points;
  });
};

/**
 * 서울·경기 버스정보시스템이 같은 정류장을 기관 코드(SEB·GGB·ICB 등)만 다르게 각자 등록해 두 번 내려온다.
 * 기관 코드를 뺀 정류소 ID가 같으면 같은 정류장으로 보고 통근 시간이 짧은 하나만 남긴다. 순서는 유지한다.
 * 규칙은 주변 버스정류장 API(#407)와 같다. 철도역(RS_)처럼 형식이 다르면 ID를 그대로 쓴다.
 */
export const stationKey = (stopId: string) => stopId.replace(/^(BS_TAGO_)[A-Z]{3}(?=\d)/, '$1');
export const uniqueStations = <T extends { stopId: string; travelMinutes: number }>(stations: T[]): T[] => {
  const best = new Map<string, T>();
  for (const station of stations) {
    const key = stationKey(station.stopId);
    const current = best.get(key);
    if (!current || station.travelMinutes < current.travelMinutes) best.set(key, station);
  }
  return stations.filter((station) => best.get(stationKey(station.stopId)) === station);
};

export const parseAdminBoundary = (value: unknown): Coordinate[][][] => {
  const boundary = readRecord(value);
  if (boundary.type === 'Polygon') return [parsePolygon(boundary.coordinates)];
  if (boundary.type === 'MultiPolygon' && Array.isArray(boundary.coordinates) && boundary.coordinates.length)
    return boundary.coordinates.map(parsePolygon);
  throw new Error('경계 형식이 올바르지 않습니다.');
};

export const fetchCommuteAreas = (
  config: PublicConfig,
  destination: Coordinate,
  maxMinutes: number,
  maxTransfers = 2,
  signal?: AbortSignal,
): Promise<CommuteResult> =>
  apiRequest({
    config,
    signal,
    path: `/api/commute-areas/with-rents?${new URLSearchParams({ latitude: String(destination.latitude), longitude: String(destination.longitude), maxMinutes: String(maxMinutes), maxTransfers: String(maxTransfers) })}`,
    parseData: (value) => {
      const record = readRecord(value);
      const areas = readArray(record, 'areas').map((value) => {
        const item = readRecord(value);
        const adminDongCode = readString(item, 'adminDongCode');
        if (!/^\d{8}$/.test(adminDongCode)) throw new Error('행정동 코드가 올바르지 않습니다.');
        const stations = uniqueStations(
          readArray(item, 'stations').map((value) => {
            const station = readRecord(value);
            if (station.direction !== null && typeof station.direction !== 'string')
              throw new Error('정류장 방향이 올바르지 않습니다.');
            const travelMinutes = readInteger(station, 'travelMinutes');
            if (travelMinutes < 0) throw new Error('통근 시간이 올바르지 않습니다.');
            return {
              ...coordinate(station),
              stopId: readString(station, 'stopId'),
              stopName: readString(station, 'stopName'),
              travelMinutes,
              direction: station.direction,
            };
          }),
        );
        const monthlyRentKrw = readNullableInteger(item, 'monthlyRentKrw');
        const depositKrw = readNullableInteger(item, 'depositKrw');
        const transactionCount = readNullableInteger(item, 'transactionCount', 1);
        const legalDongNames = readArray(item, 'legalDongNames').map((name) => {
          if (typeof name !== 'string') throw new Error('법정동 이름이 올바르지 않습니다.');
          return name;
        });
        const commuteMinutes = readInteger(item, 'commuteMinutes');
        if (!stations.length || commuteMinutes !== Math.min(...stations.map((station) => station.travelMinutes)))
          throw new Error('동네 통근 시간이 정류장 정보와 일치하지 않습니다.');
        return {
          adminDongCode,
          name: '',
          fullName: '',
          center: { latitude: stations[0].latitude, longitude: stations[0].longitude },
          commuteMinutes,
          polygons: [],
          stations,
          rent:
            monthlyRentKrw === null || depositKrw === null || transactionCount === null
              ? null
              : { monthlyRentKrw, depositKrw, transactionCount, legalDongNames },
        };
      });
      const rentStartDate = readNullableString(record, 'rentStartDate');
      const rentEndDate = readNullableString(record, 'rentEndDate');
      const areaCount = readInteger(record, 'areaCount');
      if (areaCount !== areas.length) throw new Error('행정동 개수가 일치하지 않습니다.');
      return {
        maxMinutes: readInteger(record, 'maxMinutes'),
        areaCount,
        rentPeriod: rentStartDate && rentEndDate ? { startDate: rentStartDate, endDate: rentEndDate } : null,
        areas,
      };
    },
  });

export const commuteAreaToRegion = (area: CommuteArea): MapRegion => ({
  id: area.adminDongCode,
  name: area.name,
  center: area.center,
  paths: [],
  polygons: area.polygons,
  simplifiedPolygons: area.simplifiedPolygons,
  isRecommended: true,
  summary: {
    travel: `${area.commuteMinutes}분`,
    price: area.rent ? formatManwon(area.rent.monthlyRentKrw) : undefined,
  },
});

/** 원 단위 금액을 만원 단위 문구로 바꾼다. */
export const formatManwon = (krw: number) => `${Math.round(krw / 10000).toLocaleString('ko-KR')}만원`;
