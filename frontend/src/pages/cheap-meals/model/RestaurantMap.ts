import type { MapCoordinate } from '@/features/map/lib/mapLocation';

export const RESTAURANT_SEARCH_RADIUS = 2000 as const;

export type RestaurantArea = MapCoordinate & { label: string };
