import { readArray, readRecord, readString } from '@/shared/api/responseParsers';

import { parseAdminBoundary } from './commuteApi';

export type AdminBoundary = {
  name: string;
  fullName: string;
  center: { latitude: number; longitude: number };
  polygons: ReturnType<typeof parseAdminBoundary>;
};
export type AdminBoundaries = Record<string, AdminBoundary>;
export type BoundaryManifest = { version: string; file: string };

export const fetchBoundaryManifest = async (
  baseUrl = '/boundaries',
  signal?: AbortSignal,
): Promise<BoundaryManifest> => {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/manifest.json`, {
    signal,
    credentials: 'omit',
    cache: 'no-cache',
  });
  if (!response.ok) throw new Error('경계 파일 목록을 불러오지 못했습니다.');
  const record = readRecord(await response.json());
  const version = readString(record, 'version');
  const file = readString(record, 'file');
  if (!/^\d{8}$/.test(version) || !new RegExp(`^admin-dongs\\.${version}\\.[a-f0-9]{12}\\.geojson$`).test(file))
    throw new Error('경계 파일 목록 형식이 올바르지 않습니다.');
  return { version, file };
};

export const fetchAdminBoundaries = async (
  manifest: BoundaryManifest,
  baseUrl = '/boundaries',
  signal?: AbortSignal,
): Promise<AdminBoundaries> => {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/${manifest.file}`, { signal, credentials: 'omit' });
  if (!response.ok) throw new Error('동네 경계 파일을 불러오지 못했습니다.');
  const body = readRecord(await response.json());
  if (body.type !== 'FeatureCollection') throw new Error('경계 파일 형식이 올바르지 않습니다.');
  const boundaries: AdminBoundaries = {};
  for (const value of readArray(body, 'features')) {
    const feature = readRecord(value);
    const properties = readRecord(feature.properties);
    const code = readString(properties, 'code');
    if (!/^\d{8}$/.test(code) || boundaries[code] !== undefined)
      throw new Error('경계 파일의 행정동 코드가 올바르지 않습니다.');
    if (readString(properties, 'baseDate') !== manifest.version) throw new Error('동네 경계 버전이 일치하지 않습니다.');
    const polygons = parseAdminBoundary(feature.geometry);
    const outerRing = polygons[0][0];
    const bounds = outerRing.reduce(
      (bounds, point) => ({
        minLatitude: Math.min(bounds.minLatitude, point.latitude),
        maxLatitude: Math.max(bounds.maxLatitude, point.latitude),
        minLongitude: Math.min(bounds.minLongitude, point.longitude),
        maxLongitude: Math.max(bounds.maxLongitude, point.longitude),
      }),
      { minLatitude: Infinity, maxLatitude: -Infinity, minLongitude: Infinity, maxLongitude: -Infinity },
    );
    boundaries[code] = {
      name: readString(properties, 'name'),
      fullName: readString(properties, 'fullName'),
      center: {
        latitude: (bounds.minLatitude + bounds.maxLatitude) / 2,
        longitude: (bounds.minLongitude + bounds.maxLongitude) / 2,
      },
      polygons,
    };
  }
  return boundaries;
};
