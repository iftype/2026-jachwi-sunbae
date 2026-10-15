// @vitest-environment node
import { createRequire } from 'node:module';
import { gunzipSync } from 'node:zlib';
import { expect, it } from 'vitest';

const { createBoundaryAssets } = createRequire(import.meta.url)('../../webpack/admin-boundary-assets.cjs');
const features = ['11230640', '31023780', '23010510'].map((code) => ({
  type: 'Feature',
  properties: { code, baseDate: '20250630' },
  geometry: {
    type: 'MultiPolygon',
    coordinates: [
      [
        [
          [127, 37],
          [128, 37],
          [127, 37],
        ],
        [
          [127.1, 37.1],
          [127.2, 37.1],
          [127.1, 37.1],
        ],
      ],
    ],
  },
}));

it('시도 코드별로 빠짐없이 분할하고 좌표·내부 링·속성과 기존 전체 파일을 보존한다', () => {
  const source = Buffer.from(JSON.stringify({ type: 'FeatureCollection', features }));
  const assets = createBoundaryAssets(source);
  const manifest = JSON.parse(assets.manifest);
  expect(assets.source).toEqual(source);
  expect(manifest.file).toMatch(/^admin-dongs\.20250630\.[a-f0-9]{12}\.geojson$/);
  expect(assets.partitions).toHaveLength(3);
  expect(Object.keys(manifest.files)).toEqual(['11', '23', '31']);
  for (const [index, region] of ['11', '31', '23'].entries()) {
    const part = assets.partitions.find((item: { region: string }) => item.region === region);
    expect(part.filename).toMatch(new RegExp(`^admin-dongs\\.${region}\\.20250630\\.[a-f0-9]{12}\\.geojson$`));
    expect(manifest.files[region]).toBe(part.filename);
    const generated = JSON.parse(part.source.toString());
    expect(generated.features).toHaveLength(1);
    expect(generated.features[0]).toMatchObject(features[index]);
    expect(generated.features[0].lod).toHaveProperty('overview');
    expect(gunzipSync(part.gzip)).toEqual(part.source);
  }
  expect(createBoundaryAssets(source).manifest).toBe(assets.manifest);
  const changed = createBoundaryAssets(
    Buffer.from(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          { ...features[0], properties: { ...features[0].properties, name: '변경' } },
          features[1],
          features[2],
        ],
      }),
    ),
  );
  const next = JSON.parse(changed.manifest);
  expect(next.files['11']).not.toBe(manifest.files['11']);
  expect(next.files['31']).toBe(manifest.files['31']);
  expect(next.files['23']).toBe(manifest.files['23']);
});
