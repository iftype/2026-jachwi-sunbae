import { readArray, readRecord, readString } from '@/shared/api/responseParsers';

import type { AdminBoundary } from './adminBoundaryApi';
import { parseAdminBoundary } from './commuteApi';

export type LegalBoundary = AdminBoundary & { legalDongCode: string };
export const legalApiCode = (code: string) => {
  if (!/^\d{8}(\d{2})?$/.test(code)) throw new Error('법정동 코드가 올바르지 않습니다.');
  return code.padEnd(10, '0');
};
export const fetchLegalBoundaries = async (baseUrl = '/boundaries', signal?: AbortSignal): Promise<LegalBoundary[]> => {
  const base = baseUrl.replace(/\/$/, '');
  const manifestResponse = await fetch(`${base}/legal-manifest.json`, {
    signal,
    credentials: 'omit',
    cache: 'no-cache',
  });
  if (!manifestResponse.ok) throw new Error('법정동 경계 목록을 불러오지 못했습니다.');
  const files = readRecord(readRecord(await manifestResponse.json()).files);
  const collections = await Promise.all(
    ['emd', 'lio', 'sig'].map(async (kind) => {
      const file = readString(files, kind);
      if (!new RegExp(`^legal-${kind}\\.[a-f0-9]{12}\\.geojson$`).test(file))
        throw new Error('경계 경로가 올바르지 않습니다.');
      const response = await fetch(`${base}/${file}`, { signal, credentials: 'omit' });
      if (!response.ok) throw new Error('법정동 경계를 불러오지 못했습니다.');
      const collection = readRecord(await response.json());
      if (collection.type !== 'FeatureCollection') throw new Error('경계 형식이 올바르지 않습니다.');
      return readArray(collection, 'features').map(readRecord);
    }),
  );
  const [emd, lio, sig] = collections;
  const districts = new Map(
    sig.map((feature) => {
      const props = readRecord(feature.properties);
      return [readString(props, 'A1'), readString(props, 'A2')];
    }),
  );
  const parents = new Set(lio.map((feature) => readString(readRecord(feature.properties), 'A1').slice(0, 8)));
  return [...emd.filter((feature) => !parents.has(readString(readRecord(feature.properties), 'A1'))), ...lio].map(
    (feature) => {
      const props = readRecord(feature.properties);
      const code = readString(props, 'A1');
      const name = readString(props, 'A2');
      const polygons = parseAdminBoundary(feature.geometry);
      const bounds = polygons
        .flatMap((polygon) => polygon[0])
        .reduce(
          (bounds, point) => [
            Math.min(bounds[0], point.latitude),
            Math.max(bounds[1], point.latitude),
            Math.min(bounds[2], point.longitude),
            Math.max(bounds[3], point.longitude),
          ],
          [Infinity, -Infinity, Infinity, -Infinity],
        );
      return {
        legalDongCode: legalApiCode(code),
        name,
        fullName: `${districts.get(code.slice(0, 5)) ?? districts.get(readString(props, 'A4')) ?? ''} ${name}`.trim(),
        center: { latitude: (bounds[0] + bounds[1]) / 2, longitude: (bounds[2] + bounds[3]) / 2 },
        polygons,
      };
    },
  );
};
export const nearbyLegalBoundaries = (boundaries: LegalBoundary[], point: { latitude: number; longitude: number }) =>
  boundaries
    .map((boundary) => ({
      boundary,
      distance: Math.hypot(
        (boundary.center.latitude - point.latitude) * 111.2,
        (boundary.center.longitude - point.longitude) * 111.2 * Math.cos((point.latitude * Math.PI) / 180),
      ),
    }))
    .filter((item) => item.distance <= 3)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5)
    .map((item) => item.boundary);
