import { http, HttpResponse } from 'msw';
import { expect, it } from 'vitest';

import { commuteBoundaryFixtures } from '@/app/mocks/fixtures/commuteBoundaryFixtures';
import { fetchAdminBoundaries, fetchBoundaryManifest } from '@/features/map/api/adminBoundaryApi';

import { server } from '../../../server';
const manifest = { version: '20250630', file: 'admin-dongs.20250630.123456abcdef.geojson' };

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
