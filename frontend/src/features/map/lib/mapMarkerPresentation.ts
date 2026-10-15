import type { MapMarker } from '../model/Map';
const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
/** 이 값이 같으면 마커를 다시 그릴 필요가 없다. */
export const markerSignature = (marker: MapMarker, selectedMarkerId: string | null): string =>
  [
    marker.latitude,
    marker.longitude,
    marker.tone ?? '',
    marker.category ?? '',
    marker.count ?? '',
    marker.photoUrl ?? '',
    marker.label,
    marker.caption ?? '',
    marker.actionable === true ? '1' : '0',
    selectedMarkerId === marker.id ? '1' : '0',
  ].join('|');

export const markerZIndex = (marker: MapMarker, selectedMarkerId: string | null): number => {
  if (selectedMarkerId === marker.id) return 10;
  if (marker.tone === 'selected') return 9;
  if (marker.tone === 'property' || marker.tone === 'propertyCluster') return 8;
  if (marker.tone === 'current') return 7;
  return 5;
};

export const markerScale = (marker: MapMarker, level: number): number =>
  marker.tone === 'property' || marker.tone === 'selected' || marker.tone === 'propertyCluster'
    ? Number(clamp(1 + (4 - level) * 0.12, 0.7, 1.36).toFixed(2))
    : 1;
