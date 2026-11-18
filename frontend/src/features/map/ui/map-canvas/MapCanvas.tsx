import type { MapCanvasProps } from '../../model/MapCanvas';
import MapCanvasSurface from './MapCanvasSurface';
import { SharedMapCanvasSlot, useMapCanvasHost } from './SharedMapCanvas';

const MapCanvas = ({ shared = false, ...props }: MapCanvasProps & { shared?: boolean }) => {
  const host = useMapCanvasHost();
  return shared && host ? <SharedMapCanvasSlot host={host} {...props} /> : <MapCanvasSurface {...props} />;
};
export default MapCanvas;
