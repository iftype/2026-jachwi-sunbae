import { apiRequest } from '@/features/auth/api/apiClient';
import type { MapCoordinate } from '@/features/map/lib/mapLocation';
import { readArray, readBoolean, readRecord, readString } from '@/shared/api/responseParsers';
import type { PublicConfig } from '@/shared/config/publicConfigTypes';

import type { WeatherForecastResponse, WeatherHour, WeatherNotificationSettingsResponse } from '../model/weather';

const SETTINGS_PATH = '/api/members/me/weather-notification-settings';

const readNullableNumber = (record: Record<string, unknown>, key: string): number | null => {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${key} 숫자 응답이 올바르지 않습니다.`);
  return value;
};

const readNullableText = (record: Record<string, unknown>, key: string): string | null =>
  record[key] === null || record[key] === undefined ? null : readString(record, key);

const parseHour = (value: unknown): WeatherHour => {
  const record = readRecord(value);
  return {
    forecastAt: readString(record, 'forecastAt'),
    publishedAt: readNullableText(record, 'publishedAt'),
    tmp: readNullableNumber(record, 'tmp'),
    sky: readNullableNumber(record, 'sky'),
    pty: readNullableNumber(record, 'pty'),
    pop: readNullableNumber(record, 'pop'),
    pcp: readNullableNumber(record, 'pcp'),
    sno: readNullableNumber(record, 'sno'),
    reh: readNullableNumber(record, 'reh'),
    wsd: readNullableNumber(record, 'wsd'),
  };
};

export const parseWeatherForecast = (value: unknown): WeatherForecastResponse => {
  const record = readRecord(value);
  return {
    gridX: readNullableNumber(record, 'gridX') ?? 0,
    gridY: readNullableNumber(record, 'gridY') ?? 0,
    date: readString(record, 'date'),
    timeZone: 'Asia/Seoul',
    hourly: readArray(record, 'hourly').map(parseHour),
    tmn: readNullableNumber(record, 'tmn'),
    tmx: readNullableNumber(record, 'tmx'),
    tmnPublishedAt: readNullableText(record, 'tmnPublishedAt'),
    tmxPublishedAt: readNullableText(record, 'tmxPublishedAt'),
  };
};

const parseSettings = (value: unknown): WeatherNotificationSettingsResponse => ({
  enabled: readBoolean(readRecord(value), 'enabled'),
});

/** 위경도의 기상청 격자에서 오늘(한국 시간) 00–23시 예보를 조회한다. */
export const fetchWeatherForecast = (config: PublicConfig, coordinate: MapCoordinate, signal?: AbortSignal) =>
  apiRequest({
    config,
    path: `/api/weather/forecasts?latitude=${coordinate.latitude}&longitude=${coordinate.longitude}`,
    signal,
    parseData: parseWeatherForecast,
  });

export const fetchWeatherNotificationSettings = (config: PublicConfig, signal?: AbortSignal) =>
  apiRequest({ config, path: SETTINGS_PATH, signal, parseData: parseSettings });

export const updateWeatherNotificationSettings = (config: PublicConfig, enabled: boolean) =>
  apiRequest({ config, path: SETTINGS_PATH, method: 'PUT', body: { enabled }, parseData: parseSettings });

/** 알림을 보낼 위치를 저장한다. 서버는 정확한 위경도 대신 격자만 저장하고, 이 위치로 알림을 보낸다. */
export const syncWeatherLocation = (config: PublicConfig, coordinate: MapCoordinate) =>
  apiRequest({
    config,
    path: '/api/members/me/weather-location',
    method: 'PUT',
    body: coordinate,
    parseData: (value) => ({ available: readBoolean(readRecord(value), 'available') }),
  });

export const weatherQueryKeys = {
  settings: ['weather', 'notification-settings'] as const,
  // 같은 동네에서 위치가 조금씩 흔들려도 다시 조회하지 않도록 소수 셋째 자리(약 100m)로 묶는다.
  forecast: (coordinate: MapCoordinate) =>
    ['weather', 'forecast', coordinate.latitude.toFixed(3), coordinate.longitude.toFixed(3)] as const,
  place: (coordinate: MapCoordinate) =>
    ['weather', 'place', coordinate.latitude.toFixed(3), coordinate.longitude.toFixed(3)] as const,
};
