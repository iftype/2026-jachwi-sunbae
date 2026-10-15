import { readArray, readRecord, readString } from '@/shared/api/responseParsers';

import type { MapRegion } from '../model/MapCanvas';
import { parseAdminBoundary } from './commuteApi';

export type AdminBoundary = {
  name: string;
  fullName: string;
  center: { latitude: number; longitude: number };
  polygons: ReturnType<typeof parseAdminBoundary>;
  simplifiedPolygons?: MapRegion['simplifiedPolygons'];
};
export type AdminBoundaries = Record<string, AdminBoundary>;
/** files는 SGIS 시도 코드(행정동 코드 앞 두 자리)별 파일이다. 없으면 전국 file 하나를 쓴다. */
export type BoundaryManifest = { version: string; file: string; files?: Record<string, string> };

const parseDetail = (value: unknown, polygons: AdminBoundary['polygons']) => {
  if (!Array.isArray(value) || value.length !== polygons.length) throw new Error('단순화 경계 면이 올바르지 않습니다.');
  return polygons.map((polygon, pi) => {
    const rings: unknown = value[pi];
    if (!Array.isArray(rings) || rings.length !== polygon.length)
      throw new Error('단순화 경계 링이 올바르지 않습니다.');
    return polygon.map((ring, ri) => {
      const indices: unknown = rings[ri];
      if (!Array.isArray(indices) || indices.length < 4) throw new Error('단순화 경계 정점이 올바르지 않습니다.');
      const points = indices.map((index: unknown) => {
        if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= ring.length)
          throw new Error('단순화 경계 인덱스가 올바르지 않습니다.');
        return ring[index];
      });
      const first = points[0];
      const last = points.at(-1)!;
      if (
        first.latitude !== last.latitude ||
        first.longitude !== last.longitude ||
        new Set(points.map((p) => `${p.latitude},${p.longitude}`)).size < 3
      )
        throw new Error('단순화 경계가 닫히지 않았거나 면적이 없습니다.');
      return points;
    });
  });
};

/** 목적지가 아니라 실제 검색 결과 코드의 시도 파일만 선택한다. 분할 파일이 없는 시도가 섞이면 전국 파일을 쓴다. */
export const selectBoundaryFiles = (manifest: BoundaryManifest, codes: string[]): BoundaryManifest[] => {
  if (codes.length === 0) return [];
  const files = manifest.files;
  const whole = [{ version: manifest.version, file: manifest.file }];
  if (!files) return whole;
  const regions = [...new Set(codes.map((code) => code.slice(0, 2)))];
  if (regions.some((region) => files[region] === undefined)) return whole;
  return regions.map((region) => ({ version: manifest.version, file: files[region] }));
};

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
  if (record.files === undefined) return { version, file };
  const rawFiles = readRecord(record.files);
  const files: Record<string, string> = {};
  for (const region of Object.keys(rawFiles)) {
    const filename = readString(rawFiles, region);
    if (
      !/^\d{2}$/.test(region) ||
      !new RegExp(`^admin-dongs\\.${region}\\.${version}\\.[a-f0-9]{12}\\.geojson$`).test(filename)
    )
      throw new Error('경계 파일 목록 형식이 올바르지 않습니다.');
    files[region] = filename;
  }
  return { version, file, files };
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
    const lod = feature.lod === undefined ? undefined : readRecord(feature.lod);
    const simplifiedPolygons = lod
      ? { overview: parseDetail(lod.overview, polygons), medium: parseDetail(lod.medium, polygons) }
      : undefined;
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
      ...(simplifiedPolygons ? { simplifiedPolygons } : {}),
    };
  }
  return boundaries;
};
