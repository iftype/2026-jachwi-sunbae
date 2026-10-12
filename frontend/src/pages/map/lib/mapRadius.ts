export const RADIUS_OPTIONS = [500, 1000, 2000] as const;
export type MapRadius = (typeof RADIUS_OPTIONS)[number];
export const radiusLabel = (radius: MapRadius): string => (radius === 500 ? '500m' : `${radius / 1000}km`);
export const levelForRadius = (radius: MapRadius): number => (radius === 500 ? 5 : radius === 1000 ? 6 : 7);
