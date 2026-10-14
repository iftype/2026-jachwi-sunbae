type Point = { latitude: number; longitude: number; name: string; address: string };
export type NeighborhoodSearchSession = {
  destination: Point;
  maxMinutes: number;
  maxTransfers: number;
  maxRent: number;
  selectedId: string | null;
  selectedStopId: string | null;
};
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isPoint = (value: unknown): value is Point =>
  isRecord(value) &&
  typeof value.latitude === 'number' &&
  Number.isFinite(value.latitude) &&
  Math.abs(value.latitude) <= 90 &&
  typeof value.longitude === 'number' &&
  Number.isFinite(value.longitude) &&
  Math.abs(value.longitude) <= 180 &&
  typeof value.name === 'string' &&
  typeof value.address === 'string';
const isNullableString = (value: unknown): value is string | null => value === null || typeof value === 'string';
export const readNeighborhoodSearch = (key: string): NeighborhoodSearchSession | null => {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (
      !isRecord(value) ||
      !isPoint(value.destination) ||
      typeof value.savedAt !== 'number' ||
      Date.now() - value.savedAt < 0 ||
      Date.now() - value.savedAt >= 30 * 60 * 1000 ||
      typeof value.maxMinutes !== 'number' ||
      !Number.isInteger(value.maxMinutes) ||
      value.maxMinutes < 10 ||
      value.maxMinutes > 60 ||
      value.maxMinutes % 10 !== 0 ||
      typeof value.maxTransfers !== 'number' ||
      ![0, 1, 2].includes(value.maxTransfers) ||
      typeof value.maxRent !== 'number' ||
      !Number.isInteger(value.maxRent) ||
      value.maxRent < 0 ||
      value.maxRent > 200 ||
      value.maxRent % 10 !== 0 ||
      !isNullableString(value.selectedId) ||
      !isNullableString(value.selectedStopId)
    )
      return null;
    return {
      destination: value.destination,
      maxMinutes: value.maxMinutes,
      maxTransfers: value.maxTransfers,
      maxRent: value.maxRent,
      selectedId: value.selectedId,
      selectedStopId: value.selectedStopId,
    };
  } catch {
    return null;
  }
};
export const writeNeighborhoodSearch = (key: string, value: NeighborhoodSearchSession | null) => {
  try {
    if (value) sessionStorage.setItem(key, JSON.stringify({ ...value, savedAt: Date.now() }));
    else sessionStorage.removeItem(key);
  } catch {
    /* 저장소가 차단되어도 지도 탐색은 계속할 수 있다. */
  }
};
