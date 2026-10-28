import { delay, http, HttpResponse } from 'msw';

import { distanceMeters } from '@/features/map/lib/mapViewportQuery';
import { transitStopIdForBusStop } from '@/features/map/lib/transitStop';

import {
  commuteAreaFixtures,
  mockAreaRents,
  mockRentPeriod,
  mockRequiredTransfers,
} from '../fixtures/commuteAreaFixtures';
import { fixedBusStops } from '../fixtures/placeFixtures';

type MockOptions = {
  scenario?: 'success' | 'empty' | 'unreachable' | 'network-unavailable';
  delayMs?: number;
};

const success = (data: unknown) => HttpResponse.json({ code: 'SUCCESS', message: '요청이 성공했습니다.', data });
const failure = (code: string, message: string, status: number, errors: { field: string; reason: string }[] = []) =>
  HttpResponse.json({ code, message, errors }, { status });

const readNumber = (params: URLSearchParams, field: string) => {
  const value = params.get(field);
  return value === null || value.trim() === '' ? NaN : Number(value);
};

/** 시나리오는 MSW 설정만 변경한다. 실제 API 계약에 테스트용 파라미터를 추가하지 않는다. */
export const createCommuteAreaHandlers = ({ scenario = 'success', delayMs = 800 }: MockOptions = {}) => [
  http.get('*/api/commute-areas/route', async ({ request }) => {
    const params = new URL(request.url).searchParams;
    const stopId = params.get('stopId');
    const latitude = readNumber(params, 'latitude');
    const longitude = readNumber(params, 'longitude');
    const maxMinutes = params.has('maxMinutes') ? readNumber(params, 'maxMinutes') : 60;
    const maxTransfers = params.has('maxTransfers') ? readNumber(params, 'maxTransfers') : 2;
    if (
      !stopId ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      !Number.isInteger(maxMinutes) ||
      maxMinutes < 1 ||
      maxMinutes > 180 ||
      !Number.isInteger(maxTransfers) ||
      maxTransfers < 0 ||
      maxTransfers > 10
    )
      return failure('INVALID_REQUEST', '요청 값을 확인해 주세요.', 400);
    await delay(delayMs);
    // 동네 결과의 출발 정류장 말고도, 지도에서 고른 주변 버스정류장(목 고정 좌표)에서 출발하는 경로를 거리로 어림해 돌려준다.
    const fixedStop = fixedBusStops.find((item) => transitStopIdForBusStop(item.nodeId) === stopId);
    const station =
      commuteAreaFixtures.flatMap((area) => area.stations).find((item) => item.stopId === stopId) ??
      (fixedStop && {
        stopName: fixedStop.name,
        latitude: fixedStop.latitude,
        longitude: fixedStop.longitude,
        // 지하철 속도(분당 약 500m)에 승하차 5분을 더해 어림한다.
        travelMinutes: Math.max(5, Math.round(distanceMeters(fixedStop, { latitude, longitude }) / 500) + 5),
      });
    if (!station) return failure('TRANSIT_STOP_NOT_FOUND', '정류장을 찾을 수 없습니다.', 404);
    const transfers = mockRequiredTransfers[stopId] ?? 0;
    if (station.travelMinutes > maxMinutes || transfers > maxTransfers)
      return failure('COMMUTE_ROUTE_NOT_FOUND', '조건에 맞는 경로가 없습니다.', 404);
    const start = { stopId, name: station.stopName, latitude: station.latitude, longitude: station.longitude };
    const destination = { stopId: null, name: '목적지', latitude, longitude };
    const arrival = { stopId: 'MOCK_ARRIVAL', name: '목적지 인근 정류장', latitude: latitude + 0.001, longitude };
    const transfer = {
      stopId: 'MOCK_TRANSFER',
      name: '환승 정류장',
      latitude: (station.latitude + latitude) / 2,
      longitude: (station.longitude + longitude) / 2,
    };
    const walkingMinutes = Math.min(2, station.travelMinutes);
    const ridingMinutes = station.travelMinutes - walkingMinutes;
    const legs =
      ridingMinutes === 0
        ? []
        : transfers === 1
          ? [
              {
                type: 'BUS',
                routeName: '샘플 버스',
                minutes: Math.floor(ridingMinutes / 2),
                waitMinutes: 0,
                points: [start, transfer],
              },
              {
                type: 'SUBWAY',
                routeName: '샘플 지하철',
                minutes: Math.ceil(ridingMinutes / 2),
                waitMinutes: 0,
                points: [transfer, arrival],
              },
            ]
          : [
              {
                type: stopId.startsWith('RS_') ? 'SUBWAY' : 'BUS',
                routeName: '샘플 노선',
                minutes: ridingMinutes,
                waitMinutes: 0,
                points: [start, arrival],
              },
            ];
    return success({
      totalMinutes: station.travelMinutes,
      transferCount: transfers,
      legs: [
        ...legs,
        {
          type: 'WALK',
          routeName: null,
          minutes: walkingMinutes,
          waitMinutes: 0,
          points: [ridingMinutes ? arrival : start, destination],
        },
      ],
    });
  }),
  http.get('*/api/commute-areas/with-rents', async ({ request }) => {
    const params = new URL(request.url).searchParams;
    const latitude = readNumber(params, 'latitude');
    const longitude = readNumber(params, 'longitude');
    const maxMinutes = params.has('maxMinutes') ? readNumber(params, 'maxMinutes') : 60;
    const maxTransfers = params.has('maxTransfers') ? readNumber(params, 'maxTransfers') : 2;
    const errors: { field: string; reason: string }[] = [];
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      errors.push({ field: 'latitude', reason: '위도는 -90 이상 90 이하의 숫자여야 합니다.' });
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      errors.push({ field: 'longitude', reason: '경도는 -180 이상 180 이하의 숫자여야 합니다.' });
    }
    if (!Number.isInteger(maxMinutes) || maxMinutes < 1 || maxMinutes > 180) {
      errors.push({ field: 'maxMinutes', reason: '1분 이상 180분 이하의 정수여야 합니다.' });
    }
    if (!Number.isInteger(maxTransfers) || maxTransfers < 0 || maxTransfers > 10) {
      errors.push({ field: 'maxTransfers', reason: '0회 이상 10회 이하의 정수여야 합니다.' });
    }
    if (errors.length) return failure('INVALID_REQUEST', '요청 값을 확인해 주세요.', 400, errors);

    await delay(delayMs);
    if (scenario === 'unreachable') {
      return failure(
        'COMMUTE_DESTINATION_UNREACHABLE',
        '목적지에서 걸어서 10분 안에 이용할 수 있는 정류장·역이 없습니다.',
        400,
      );
    }
    if (scenario === 'network-unavailable') {
      return failure(
        'TRANSIT_NETWORK_UNAVAILABLE',
        '대중교통 정보를 준비하고 있습니다. 잠시 후 다시 시도해 주세요.',
        503,
      );
    }
    const areas =
      scenario === 'empty'
        ? []
        : commuteAreaFixtures
            .map((area) => {
              const stations = area.stations
                .filter(
                  (station) =>
                    station.travelMinutes <= maxMinutes && mockRequiredTransfers[station.stopId] <= maxTransfers,
                )
                .sort((a, b) => a.travelMinutes - b.travelMinutes);
              return {
                ...area,
                ...(mockAreaRents[area.adminDongCode] ?? {
                  monthlyRentKrw: null,
                  depositKrw: null,
                  transactionCount: null,
                  legalDongNames: [],
                }),
                stations,
                commuteMinutes: stations[0]?.travelMinutes ?? Infinity,
              };
            })
            .filter((area) => area.stations.length > 0)
            .sort(
              (first, second) =>
                first.commuteMinutes - second.commuteMinutes || first.adminDongCode.localeCompare(second.adminDongCode),
            );
    return success({
      maxMinutes,
      areaCount: areas.length,
      rentStartDate: mockRentPeriod.startDate,
      rentEndDate: mockRentPeriod.endDate,
      areas,
    });
  }),
];

export const commuteAreaHandlers = createCommuteAreaHandlers();
