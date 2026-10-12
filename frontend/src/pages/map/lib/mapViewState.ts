import type { MapCoordinate } from '@/features/map/lib/mapLocation';
import type { MapCategory } from '@/features/map/model/Map';

import type { MapPropertySheetStage } from '../model/MapSheet';
import type { MapRadius } from './mapRadius';

export type MapViewState = {
  center: MapCoordinate;
  level: number;
  selectedPropertyId: number | null;
  nearbyAnchor: MapCoordinate;
  hasNearbyAnchor: boolean;
  radius: MapRadius | null;
  categories: MapCategory[];
  sheetStage: MapPropertySheetStage;
};

// 방문 기록별로 보관한다. 새 지도 진입과 상세에서 돌아오는 진입을 구분한다.
const views = new Map<string, MapViewState>();

export const readMapView = (historyKey: string, routeState: unknown): MapViewState | undefined => {
  const key =
    typeof routeState === 'object' &&
    routeState !== null &&
    'mapViewKey' in routeState &&
    typeof routeState.mapViewKey === 'string'
      ? routeState.mapViewKey
      : historyKey;
  return views.get(key);
};

export const writeMapView = (historyKey: string, view: MapViewState): void => {
  views.set(historyKey, view);
  if (views.size > 20) {
    const oldestKey = views.keys().next().value;
    if (oldestKey !== undefined) views.delete(oldestKey);
  }
};
