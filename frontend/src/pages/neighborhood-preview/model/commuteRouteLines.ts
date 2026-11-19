import type { CommuteRoute } from '@/features/map/api/commuteRouteApi';
import type { MapRoute } from '@/features/map/model/MapCanvas';

/** 지도 선 색. 경로 안내(`RouteGuide`)의 구간 색과 같다(버스 노랑, 지하철 파랑, 걷기 회색 점선). */
export const ROUTE_LINE_COLORS: Record<CommuteRoute['legs'][number]['type'], string> = {
  BUS: '#f5b91e',
  SUBWAY: '#6b9ae6',
  WALK: '#7b8189',
};

/** 동선의 구간마다 지도에 그을 선 하나를 만든다. 걷는 구간은 점선이다. */
export const commuteRouteLines = (route: CommuteRoute, id: string): MapRoute[] =>
  route.legs.map((leg, index) => ({
    id: `${id}:${index}`,
    points: leg.points.map(({ latitude, longitude }) => ({ latitude, longitude })),
    color: ROUTE_LINE_COLORS[leg.type],
    dashed: leg.type === 'WALK' || undefined,
  }));
