import { http, HttpResponse } from 'msw';
import { expect, it } from 'vitest';

import { commuteBoundaryFixtures } from '@/app/mocks/fixtures/commuteBoundaryFixtures';
import { fetchAdminBoundaries, fetchBoundaryManifest, selectBoundaryFiles } from '@/features/map/api/adminBoundaryApi';

import { server } from '../../../server';
const manifest = { version: '20250630', file: 'admin-dongs.20250630.123456abcdef.geojson' };
const splitManifest = {
  ...manifest,
  files: {
    '11': 'admin-dongs.11.20250630.111111111111.geojson',
    '23': 'admin-dongs.23.20250630.333333333333.geojson',
    '31': 'admin-dongs.31.20250630.222222222222.geojson',
  },
};

it.each([false, true])('LOD 인덱스의 원본 좌표 참조를 복원하고 잘못된 인덱스를 거절한다: %s', async (invalid) => {
  const indices = [[[0, 1, invalid ? 99 : 2, 3, 0]]];
  server.use(
    http.get('https://cdn.example.com/:filename', () =>
      HttpResponse.json({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { code: '11230640', name: '동', fullName: '서울 동', baseDate: '20250630' },
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [127, 37],
                  [127.01, 37],
                  [127.01, 37.01],
                  [127, 37.01],
                  [127, 37],
                ],
              ],
            },
            lod: { overview: indices, medium: indices },
          },
        ],
      }),
    ),
  );
  const result = fetchAdminBoundaries(manifest, 'https://cdn.example.com');
  if (invalid) await expect(result).rejects.toThrow('인덱스');
  else {
    const boundaries = await result;
    expect(boundaries['11230640'].simplifiedPolygons?.overview[0][0][1]).toBe(boundaries['11230640'].polygons[0][0][1]);
  }
});

it('결과에 나온 시도 파일만 중복 없이 고르고 빈 결과는 다운로드하지 않는다', async () => {
  server.use(http.get('https://cdn.example.com/manifest.json', () => HttpResponse.json(splitManifest)));
  const parsed = await fetchBoundaryManifest('https://cdn.example.com');
  expect(parsed).toEqual(splitManifest);
  expect(selectBoundaryFiles(parsed, ['11230640', '31023780', '11230640'])).toEqual([
    { version: manifest.version, file: splitManifest.files['11'] },
    { version: manifest.version, file: splitManifest.files['31'] },
  ]);
  expect(selectBoundaryFiles(parsed, [])).toEqual([]);
  expect(selectBoundaryFiles(parsed, ['23010510'])).toEqual([
    { version: manifest.version, file: splitManifest.files['23'] },
  ]);
  // 분할 파일이 없는 시도가 섞이면 누락 대신 전국 파일을 받는다.
  expect(selectBoundaryFiles(parsed, ['11230640', '39010510'])).toEqual([manifest]);
  expect(selectBoundaryFiles(manifest, ['11230640'])).toEqual([manifest]);
});

it.each([
  { '11': '../outside.geojson' },
  { '11': 'admin-dongs.11.20250629.111111111111.geojson' },
  { '11': splitManifest.files['31'] },
  { seoul: 'admin-dongs.seoul.20250630.111111111111.geojson' },
])('분할 manifest의 잘못된 항목 %o는 거절한다', async (files) => {
  server.use(
    http.get('https://cdn.example.com/manifest.json', () =>
      HttpResponse.json({ ...splitManifest, files: { ...splitManifest.files, ...files } }),
    ),
  );
  await expect(fetchBoundaryManifest('https://cdn.example.com')).rejects.toThrow('목록 형식');
});

it('전국 원본 한 파일을 요청하고 SGIS 코드로 경도를 위도와 구분해 파싱한다', async () => {
  const files: string[] = [];
  server.use(
    http.get('https://cdn.example.com/boundaries/:filename', ({ params }) => {
      files.push(String(params.filename));
      return HttpResponse.json({
        type: 'FeatureCollection',
        features: [commuteBoundaryFixtures[0], commuteBoundaryFixtures[2]].map((fixture) => ({
          type: 'Feature',
          properties: {
            code: fixture.sourceCode,
            name: fixture.fullName.split(' ').at(-1),
            fullName: fixture.fullName,
            baseDate: '20250630',
          },
          geometry: fixture.boundary,
        })),
      });
    }),
  );
  const result = await fetchAdminBoundaries(manifest, 'https://cdn.example.com/boundaries');
  expect(files).toHaveLength(1);
  expect(files[0]).toMatch(/^admin-dongs.*\.geojson$/);
  expect(Object.keys(result)).toEqual(['11230640', '31023780']);
  expect(result['11230640'].polygons[0][0][0].longitude).toBeGreaterThan(120);
  expect(result['11230640'].polygons[0][0][0].latitude).toBeLessThan(40);
  expect(result['11230640'].name).toBe('역삼1동');
});
it('다른 버전의 CDN 파일은 거절한다', async () => {
  server.use(
    http.get('https://cdn.example.com/:filename', () =>
      HttpResponse.json({
        type: 'FeatureCollection',
        features: [
          {
            properties: { code: '11230640', name: '역삼1동', fullName: '서울특별시 강남구 역삼1동', baseDate: 'old' },
            geometry: commuteBoundaryFixtures[0].boundary,
          },
        ],
      }),
    ),
  );
  await expect(fetchAdminBoundaries(manifest, 'https://cdn.example.com')).rejects.toThrow('버전');
});
it('CDN 다운로드 실패는 거절한다', async () => {
  server.use(http.get('https://cdn.example.com/:filename', () => new HttpResponse(null, { status: 503 })));
  await expect(fetchAdminBoundaries(manifest, 'https://cdn.example.com')).rejects.toThrow('경계 파일');
});
it('고정 manifest 주소에서 현재 파일명을 읽는다', async () => {
  server.use(http.get('https://cdn.example.com/manifest.json', () => HttpResponse.json(manifest)));
  expect(await fetchBoundaryManifest('https://cdn.example.com')).toEqual(manifest);
});
it.each(['../other.json', 'https://other.example/file.geojson', 'admin-dongs.20250630.bad.geojson'])(
  '잘못된 manifest 경로 %s를 거절한다',
  async (file) => {
    server.use(http.get('https://cdn.example.com/manifest.json', () => HttpResponse.json({ ...manifest, file })));
    await expect(fetchBoundaryManifest('https://cdn.example.com')).rejects.toThrow('목록 형식');
  },
);
