import type { MapBounds } from '../model/Map';

export type MapSearchRadius = 500 | 1000 | 2000;
export type ViewportQuery = {
  center: { latitude: number; longitude: number };
  radius: MapSearchRadius;
  bounds: MapBounds;
};

const RADII: MapSearchRadius[] = [500, 1000, 2000];
const EARTH_RADIUS_METERS = 6_371_008.8;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export const distanceMeters = (
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) => {
  const dLatitude = toRadians(to.latitude - from.latitude);
  const dLongitude = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(dLatitude / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
};

/** 좌표를 소수점 5자리(약 1m)로 맞춰 같은 화면을 다시 볼 때 같은 요청이 되게 한다. */
const round = (value: number) => Math.round(value * 100_000) / 100_000;

/**
 * 지도 화면의 가운데를 중심으로, 화면 모서리까지 덮는 가장 작은 지원 반경을 고른다.
 * 서버 반경은 최대 2km라 화면이 그보다 넓으면 가운데 2km만 요청한다.
 */
export const viewportQuery = (bounds: MapBounds): ViewportQuery => {
  const center = {
    latitude: round((bounds.south + bounds.north) / 2),
    longitude: round((bounds.west + bounds.east) / 2),
  };
  const corner = distanceMeters(center, { latitude: bounds.north, longitude: bounds.east });
  return { center, radius: RADII.find((radius) => radius >= corner) ?? 2000, bounds };
};

export const isInBounds = (point: { latitude: number; longitude: number }, bounds: MapBounds) =>
  point.latitude >= bounds.south &&
  point.latitude <= bounds.north &&
  point.longitude >= bounds.west &&
  point.longitude <= bounds.east;
