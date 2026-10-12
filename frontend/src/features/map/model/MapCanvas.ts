import type { MapBounds, MapMarker } from './Map';
export type MapRadiusCircle = {
  radiusMeters: 500 | 1000 | 2000;
  label: string;
};

export type MapCanvasProps = {
  center: { latitude: number; longitude: number };
  markers?: MapMarker[];
  circles?: MapRadiusCircle[];
  level?: number;
  interactive?: boolean;
  showCenterPin?: boolean;
  showRadiusLabels?: boolean;
  selectedMarkerId?: string | null;
  onSelectMarker?: (marker: MapMarker) => void;
  onSelectLocation?: (latitude: number, longitude: number) => void;
  onCenterChange?: (latitude: number, longitude: number) => void;
  onLevelChange?: (level: number) => void;
  onBoundsChange?: (bounds: MapBounds) => void;
  radiusCenter?: { latitude: number; longitude: number };
};
