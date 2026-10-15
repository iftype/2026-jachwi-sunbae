// @vitest-environment node
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

const square = [
  [127, 37],
  [127.02, 37],
  [127.02, 37.04],
  [127, 37.04],
  [127, 37],
];
const featureCollection = (features: unknown[]) => ({ type: 'FeatureCollection', features });
const dong = (code: string, extra: Record<string, unknown> = {}) => ({
  type: 'Feature',
  properties: { code, name: '동', fullName: '시 동', baseDate: '20250630' },
  geometry: { type: 'Polygon', coordinates: [square] },
  ...extra,
});
const serve = (body: Parameters<typeof HttpResponse.json>[0]) =>
  server.use(http.get('https://cdn.example.com/:filename', () => HttpResponse.json(body)));

it('바깥 링의 최소·최대 좌표 가운데를 동 중심으로 쓴다', async () => {
  // 처음 점이 최소·최대가 아니도록 시작점을 돌린다.
  const rotated = [square[2], square[3], square[0], square[1], square[2]];
  serve(featureCollection([dong('11230640', { geometry: { type: 'Polygon', coordinates: [rotated] } })]));
  const boundaries = await fetchAdminBoundaries(manifest, 'https://cdn.example.com');
  expect(boundaries['11230640'].center.latitude).toBeCloseTo(37.02, 10);
  expect(boundaries['11230640'].center.longitude).toBeCloseTo(127.01, 10);
});

it('정점 네 개로 닫힌 단순화 링과 마지막 정점 인덱스는 받아들인다', async () => {
  const indices = [[[0, 1, 2, 4]]];
  serve(featureCollection([dong('11230640', { lod: { overview: indices, medium: [[[0, 2, 3, 0]]] } })]));
  const boundaries = await fetchAdminBoundaries(manifest, 'https://cdn.example.com');
  expect(boundaries['11230640'].simplifiedPolygons?.overview[0][0]).toHaveLength(4);
});

it.each([
  ['면 개수가 다름', { overview: [[[0, 1, 2, 0]], [[0, 1, 2, 0]]], medium: [[[0, 1, 2, 0]]] }],
  ['면이 배열이 아님', { overview: 'x', medium: [[[0, 1, 2, 0]]] }],
  [
    '링 개수가 다름',
    {
      overview: [
        [
          [0, 1, 2, 0],
          [0, 1, 2, 0],
        ],
      ],
      medium: [[[0, 1, 2, 0]]],
    },
  ],
  ['링이 배열이 아님', { overview: ['x'], medium: [[[0, 1, 2, 0]]] }],
  ['정점이 셋뿐임', { overview: [[[0, 1, 0]]], medium: [[[0, 1, 2, 0]]] }],
  ['정점이 배열이 아님', { overview: [['x']], medium: [[[0, 1, 2, 0]]] }],
  ['정수가 아닌 인덱스', { overview: [[[0, 1.5, 2, 0]]], medium: [[[0, 1, 2, 0]]] }],
  ['숫자가 아닌 인덱스', { overview: [[[0, '1', 2, 0]]], medium: [[[0, 1, 2, 0]]] }],
  ['음수 인덱스', { overview: [[[0, -1, 2, 0]]], medium: [[[0, 1, 2, 0]]] }],
  ['링 길이와 같은 인덱스', { overview: [[[0, 1, 5, 0]]], medium: [[[0, 1, 2, 0]]] }],
  ['위도가 닫히지 않음', { overview: [[[0, 1, 2, 3]]], medium: [[[0, 1, 2, 0]]] }],
  ['경도만 닫히지 않음', { overview: [[[0, 1, 2, 1]]], medium: [[[0, 1, 2, 0]]] }],
  ['서로 다른 점이 셋 미만', { overview: [[[0, 1, 1, 0]]], medium: [[[0, 1, 2, 0]]] }],
  ['medium만 잘못됨', { overview: [[[0, 1, 2, 0]]], medium: [[[0, 1, 0]]] }],
])('단순화 경계가 잘못되면 거절한다: %s', async (_case, lod) => {
  serve(featureCollection([dong('11230640', { lod })]));
  await expect(fetchAdminBoundaries(manifest, 'https://cdn.example.com')).rejects.toThrow('단순화 경계');
});

it('경도만 다른 점은 위도가 같아도 닫히지 않은 링으로 본다', async () => {
  // [127,37] → [127.02,37]: 위도는 같고 경도만 다르다.
  serve(featureCollection([dong('11230640', { lod: { overview: [[[0, 2, 3, 1]]], medium: [[[0, 1, 2, 0]]] } })]));
  await expect(fetchAdminBoundaries(manifest, 'https://cdn.example.com')).rejects.toThrow('닫히지');
});

it.each([
  ['FeatureCollection이 아님', { type: 'Feature', features: [] }],
  ['행정동 코드가 8자리가 아님', featureCollection([dong('1123064')])],
  ['행정동 코드 앞에 다른 문자', featureCollection([dong('x11230640')])],
  ['행정동 코드 뒤에 다른 문자', featureCollection([dong('11230640x')])],
  ['같은 행정동 코드가 두 번', featureCollection([dong('11230640'), dong('11230640')])],
])('경계 파일 형식이 잘못되면 거절한다: %s', async (_case, body) => {
  serve(body);
  await expect(fetchAdminBoundaries(manifest, 'https://cdn.example.com')).rejects.toThrow();
});

it('기본 주소 끝의 슬래시를 하나로 합쳐 manifest와 경계 파일을 요청한다', async () => {
  const urls: string[] = [];
  server.use(
    http.get('https://cdn.example.com/:filename', ({ request }) => {
      urls.push(new URL(request.url).pathname);
      return HttpResponse.json(
        request.url.endsWith('manifest.json') ? manifest : featureCollection([dong('11230640')]),
      );
    }),
  );
  const parsed = await fetchBoundaryManifest('https://cdn.example.com/');
  await fetchAdminBoundaries(parsed, 'https://cdn.example.com/');
  expect(urls).toEqual(['/manifest.json', `/${manifest.file}`]);
});

it('manifest를 받지 못하면 거절한다', async () => {
  server.use(http.get('https://cdn.example.com/manifest.json', () => new HttpResponse(null, { status: 503 })));
  await expect(fetchBoundaryManifest('https://cdn.example.com')).rejects.toThrow('경계 파일 목록');
});

it.each([
  ['기준일 앞에 다른 숫자', { ...manifest, version: '120250630' }],
  ['기준일 뒤에 다른 숫자', { ...manifest, version: '202506301' }],
  ['시도 코드 앞에 다른 문자', { ...splitManifest, files: { x11: 'admin-dongs.x11.20250630.111111111111.geojson' } }],
  ['시도 코드가 세 자리', { ...splitManifest, files: { '111': 'admin-dongs.111.20250630.111111111111.geojson' } }],
])('manifest 형식이 어긋나면 거절한다: %s', async (_case, body) => {
  server.use(http.get('https://cdn.example.com/manifest.json', () => HttpResponse.json(body)));
  await expect(fetchBoundaryManifest('https://cdn.example.com')).rejects.toThrow('목록 형식');
});
