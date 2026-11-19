import { expect, it } from 'vitest';

import { commuteRouteLines } from '@/pages/neighborhood-preview/model/commuteRouteLines';

it('동선의 구간마다 수단 색의 선을 하나씩 만들고 걷는 구간만 점선으로 긋는다', () => {
  const point = (name: string, latitude: number) => ({ stopId: null, name, latitude, longitude: 127 });
  const lines = commuteRouteLines(
    {
      totalMinutes: 30,
      transferCount: 1,
      legs: [
        {
          type: 'WALK',
          routeName: null,
          minutes: 4,
          waitMinutes: 0,
          points: [point('출발지', 37.5), point('A', 37.51)],
        },
        { type: 'BUS', routeName: '146', minutes: 10, waitMinutes: 2, points: [point('A', 37.51), point('B', 37.52)] },
        {
          type: 'SUBWAY',
          routeName: '2호선',
          minutes: 14,
          waitMinutes: 1,
          points: [point('B', 37.52), point('C', 37.55)],
        },
      ],
    },
    'property-route:7',
  );
  expect(lines).toEqual([
    {
      id: 'property-route:7:0',
      color: '#7b8189',
      dashed: true,
      points: [
        { latitude: 37.5, longitude: 127 },
        { latitude: 37.51, longitude: 127 },
      ],
    },
    { id: 'property-route:7:1', color: '#f5b91e', dashed: undefined, points: expect.any(Array) },
    { id: 'property-route:7:2', color: '#6b9ae6', dashed: undefined, points: expect.any(Array) },
  ]);
});
