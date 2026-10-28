import type { MapCoordinate } from '@/features/map/lib/mapLocation';

const STORAGE_KEY = 'jachwi-weather-last-coordinate';

/** 현재 위치를 못 잡을 때 날씨를 보여 줄 마지막 위치. 서버도 마지막으로 저장한 위치로 알림을 보낸다. */
export const readLastWeatherCoordinate = (storage: Storage = window.localStorage): MapCoordinate | null => {
  try {
    const value: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null');
    if (typeof value !== 'object' || value === null) return null;
    const { latitude, longitude } = value as Record<string, unknown>;
    return typeof latitude === 'number' && typeof longitude === 'number' ? { latitude, longitude } : null;
  } catch {
    return null;
  }
};

export const writeLastWeatherCoordinate = (coordinate: MapCoordinate, storage: Storage = window.localStorage) => {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(coordinate));
  } catch {
    // 저장소를 못 쓰는 브라우저(사생활 보호 모드 등)에서는 마지막 위치 없이 동작한다.
  }
};
