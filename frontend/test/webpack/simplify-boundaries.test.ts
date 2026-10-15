// @vitest-environment node
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';

const { simplifyBoundaryLevels } = createRequire(import.meta.url)('../../webpack/simplify-boundaries.cjs');
type Point = [number, number];
const shared: Point[] = [
  [127.01, 37],
  [127.01001, 37.0025],
  [127.00999, 37.005],
  [127.01001, 37.0075],
  [127.01, 37.01],
];
const hole: Point[] = [
  [127.005, 37.005],
  [127.00501, 37.005],
  [127.005, 37.00501],
  [127.005, 37.005],
];
const left: Point[][] = [[[127, 37], ...shared, [127, 37.01], [127, 37]], hole];
const right: Point[][] = [[shared[0], [127.02, 37], [127.02, 37.01], ...shared.slice(1).reverse(), shared[0]]];

it('공유 경계를 같은 정점으로 단순화하고 작은 내부 링과 분리된 면을 보존한다', () => {
  const features = [left, right].map((coordinates, i) => ({
    type: 'Feature',
    properties: { code: String(i) },
    geometry: { type: 'MultiPolygon', coordinates: [coordinates] },
  }));
  const generated = simplifyBoundaryLevels({ type: 'FeatureCollection', features });
  for (const level of ['overview', 'medium']) {
    const decode = (index: number): Point[][][] =>
      generated[index].lod[level].map((polygon: number[][]) =>
        polygon.map((indices: number[], ri: number) =>
          indices.map((i) => features[index].geometry.coordinates[0][ri][i]),
        ),
      );
    const a = decode(0);
    const b = decode(1);
    expect(a).toHaveLength(1);
    expect(a[0]).toHaveLength(2);
    expect(new Set(a[0][1].map((p) => p.join(','))).size).toBe(3);
    const border = (ring: Point[]) =>
      [...new Set(ring.filter((p) => p[0] > 127.009 && p[0] < 127.011).map((p) => p.join(',')))].sort();
    expect(border(a[0][0])).toEqual(border(b[0][0]));
    expect(a[0][0].length).toBeLessThan(left[0].length);
    for (const polygon of [...a, ...b])
      for (const ring of polygon) {
        expect(ring.length).toBeGreaterThanOrEqual(4);
        expect(ring[0]).toEqual(ring.at(-1));
      }
  }
  expect(generated[0].geometry).toEqual(features[0].geometry);
});
