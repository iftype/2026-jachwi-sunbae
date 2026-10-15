import { expect, it } from 'vitest';

import { regionAtLevel } from '@/features/map/lib/mapRegionLayer';
import type { MapRegion } from '@/features/map/model/MapCanvas';

it('앱 축척 8 이상은 overview, 5~7은 medium, 4 이하는 원본을 고른다', () => {
  const original = [[[{ latitude: 37, longitude: 127 }]]];
  const overview = [[[{ latitude: 37.1, longitude: 127 }]]];
  const medium = [[[{ latitude: 37.2, longitude: 127 }]]];
  const region: MapRegion = {
    id: 'a',
    name: '동',
    paths: [],
    polygons: original,
    simplifiedPolygons: { overview, medium },
  };
  expect(regionAtLevel(region, 10).polygons).toBe(overview);
  expect(regionAtLevel(region, 8).polygons).toBe(overview);
  expect(regionAtLevel(region, 7).polygons).toBe(medium);
  expect(regionAtLevel(region, 5).polygons).toBe(medium);
  expect(regionAtLevel(region, 4).polygons).toBe(original);
  expect(regionAtLevel({ ...region, simplifiedPolygons: undefined }, 10).polygons).toBe(original);
});
