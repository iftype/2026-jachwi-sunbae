import { useEffect, useMemo, useRef, useState } from 'react';

import { usePublicConfig } from '@/shared/config/PublicConfigContext';

import { clampToSouthKorea } from '../lib/mapLocation';
import { markerScale, markerSignature, markerZIndex } from '../lib/mapMarkerPresentation';
import { createMapRegionLayer, READY_TIMEOUT_MS } from '../lib/mapRegionLayer';
import { type LiveMap, type LiveOverlay, naverEngine } from '../lib/naverMapEngine';
import type { MapCanvasProps } from '../model/MapCanvas';
import { createMapMarkerElement } from '../ui/map-marker/MapMarkerView';

import actionStyles from '../ui/map-canvas/MapCanvas.module.css';
const EMPTY_MARKERS: NonNullable<MapCanvasProps['markers']> = [];
const EMPTY_CIRCLES: NonNullable<MapCanvasProps['circles']> = [];
const EMPTY_REGIONS: NonNullable<MapCanvasProps['regions']> = [];

type LiveMapProps = Pick<
  MapCanvasProps,
  | 'center'
  | 'animateView'
  | 'coordinateAction'
  | 'level'
  | 'customStyleId'
  | 'markers'
  | 'circles'
  | 'radiusCenter'
  | 'selectedMarkerId'
  | 'onSelectLocation'
  | 'onCenterChange'
  | 'onLevelChange'
  | 'onSelectMarker'
  | 'onBoundsChange'
  | 'regions'
  | 'selectedRegionId'
  | 'onSelectRegion'
>;

/** SDK의 수명과 동기화는 이 Hook에만 두고 화면은 지도 표현만 조립한다. */
const useNaverMap = ({
  center,
  animateView = false,
  coordinateAction,
  level = 5,
  customStyleId,
  markers = EMPTY_MARKERS,
  circles = EMPTY_CIRCLES,
  radiusCenter = center,
  selectedMarkerId = null,
  onSelectLocation,
  onCenterChange,
  onLevelChange,
  onSelectMarker,
  onBoundsChange,
  regions = EMPTY_REGIONS,
  selectedRegionId = null,
  onSelectRegion,
}: LiveMapProps) => {
  const config = usePublicConfig();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LiveMap | null>(null);
  const overlaysRef = useRef(new Map<string, { signature: string; overlay: LiveOverlay; content: HTMLElement }>());
  const circlesRef = useRef<LiveOverlay[]>([]);
  const regionLayerRef = useRef<ReturnType<typeof createMapRegionLayer> | null>(null);
  const circleSignatureRef = useRef('');
  const callbackRef = useRef({ onSelectLocation, onCenterChange, onLevelChange, onSelectMarker, onBoundsChange });
  const [mapReady, setMapReady] = useState(false);
  // SDK 로드와 GL 준비 사이에는 지도를 눌러도 반응이 없으므로 화면에 준비 중임을 알린다.
  const [renderReady, setRenderReady] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const gestureActiveRef = useRef(false);
  const [settledVersion, setSettledVersion] = useState(0);
  const setGestureActive = (active: boolean) => {
    gestureActiveRef.current = active;
    if (canvasRef.current !== null) {
      if (active) canvasRef.current.dataset.mapGesture = 'true';
      else delete canvasRef.current.dataset.mapGesture;
    }
  };
  const [sdkError, setSdkError] = useState(false);
  const regionCallbackRef = useRef(onSelectRegion);
  regionCallbackRef.current = onSelectRegion;
  // 남한 밖 좌표를 받아도 지도는 남한 안만 비춘다.
  const boundedCenter = useMemo(() => clampToSouthKorea(center), [center.latitude, center.longitude]);
  const engine = useMemo(
    () => naverEngine(config.naverMapClientId ?? '', customStyleId),
    [config.naverMapClientId, customStyleId],
  );
  const liveMode = config.mapProviderMode === 'naver' && (config.naverMapClientId ?? '') !== '';
  const initialViewRef = useRef({ center: boundedCenter, level });
  initialViewRef.current = { center: boundedCenter, level };
  const circleRadii = circles.map((circle) => circle.radiusMeters).join(',');

  callbackRef.current = { onSelectLocation, onCenterChange, onLevelChange, onSelectMarker, onBoundsChange };

  useEffect(() => {
    if (!liveMode || containerRef.current === null) return;
    let disposed = false;
    let map: LiveMap | null = null;
    let listeners: unknown[] = [];
    let readyFrame: number | null = null;

    setSdkError(false);
    setMapReady(false);
    setRenderReady(false);
    void engine
      .load()
      .then(() => {
        if (disposed || containerRef.current === null) return;
        map = engine.createMap(containerRef.current, initialViewRef.current.center, initialViewRef.current.level);
        mapRef.current = map;

        listeners.push(
          engine.addListener(map, 'dragstart', () => setGestureActive(true)),
          engine.addListener(map, 'zoomstart', () => setGestureActive(true)),
        );
        listeners.push(
          engine.addListener(map, 'click', (latitude, longitude) => {
            if (latitude !== undefined && longitude !== undefined)
              callbackRef.current.onSelectLocation?.(latitude, longitude);
          }),
          engine.addListener(map, 'idle', () => {
            setGestureActive(false);
            if (map === null) return;
            setSettledVersion((current) => current + 1);
            const nextCenter = engine.getCenter(map);
            callbackRef.current.onCenterChange?.(nextCenter.latitude, nextCenter.longitude);
            callbackRef.current.onLevelChange?.(engine.getZoom(map));
            callbackRef.current.onBoundsChange?.(engine.getBounds(map));
          }),
        );
        setMapReady(true);
        callbackRef.current.onBoundsChange?.(engine.getBounds(map));
        const createdAt = performance.now();
        const waitForRender = () => {
          readyFrame = null;
          if (disposed || map === null) return;
          if (engine.isRenderReady(map) || performance.now() - createdAt >= READY_TIMEOUT_MS) {
            setRenderReady(true);
            return;
          }
          readyFrame = window.requestAnimationFrame(waitForRender);
        };
        waitForRender();
      })
      .catch(() => {
        if (!disposed) setSdkError(true);
      });

    return () => {
      disposed = true;
      if (readyFrame !== null) window.cancelAnimationFrame(readyFrame);
      listeners.forEach((listener) => engine.removeListener(listener));
      listeners = [];
      setGestureActive(false);
      overlaysRef.current.forEach(({ overlay }) => overlay.setMap(null));
      overlaysRef.current.clear();
      circlesRef.current.forEach((circle) => circle.setMap(null));
      circlesRef.current = [];
      circleSignatureRef.current = '';
      if (map !== null) engine.destroy(map);
      mapRef.current = null;
    };
  }, [engine, liveMode]);

  useEffect(() => {
    if (animateView || !liveMode || !mapReady || mapRef.current === null) return;
    const current = engine.getCenter(mapRef.current);
    if (
      Math.abs(current.latitude - boundedCenter.latitude) < 0.0000001 &&
      Math.abs(current.longitude - boundedCenter.longitude) < 0.0000001
    )
      return;
    engine.setCenter(mapRef.current, engine.latLng(boundedCenter.latitude, boundedCenter.longitude));
  }, [boundedCenter, engine, liveMode, mapReady, animateView]);

  useEffect(() => {
    const map = mapRef.current;
    if (!animateView || !liveMode || !mapReady || map === null) return;
    const current = engine.getCenter(map);
    if (
      Math.abs(current.latitude - boundedCenter.latitude) < 0.0000001 &&
      Math.abs(current.longitude - boundedCenter.longitude) < 0.0000001 &&
      engine.getZoom(map) === level
    )
      return;
    engine.animateView(map, engine.latLng(boundedCenter.latitude, boundedCenter.longitude), level);
  }, [boundedCenter, engine, liveMode, mapReady, animateView, level]);

  useEffect(() => {
    if (
      !liveMode ||
      !mapReady ||
      typeof ResizeObserver === 'undefined' ||
      containerRef.current === null ||
      mapRef.current === null
    )
      return;
    const map = mapRef.current;
    let relayoutFrame: number | null = null;
    let previousSize = '';
    const observer = new ResizeObserver(() => {
      if (relayoutFrame !== null) return;
      relayoutFrame = window.requestAnimationFrame(() => {
        relayoutFrame = null;
        const container = containerRef.current;
        if (container === null || container.clientWidth === 0 || container.clientHeight === 0) return;
        const size = `${container.clientWidth}x${container.clientHeight}`;
        if (size === previousSize) return;
        previousSize = size;
        engine.relayout(map);
        callbackRef.current.onBoundsChange?.(engine.getBounds(map));
      });
    });
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      if (relayoutFrame !== null) window.cancelAnimationFrame(relayoutFrame);
    };
  }, [engine, liveMode, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (animateView || !liveMode || !mapReady || map === null || engine.getZoom(map) === level) return;
    engine.setZoom(map, level);
  }, [engine, level, liveMode, mapReady, animateView]);

  useEffect(() => {
    const map = mapRef.current;
    if (!liveMode || !mapReady || map === null || gestureActiveRef.current) return;
    // 달라진 마커만 다시 그린다. 전부 지웠다 만들면 지도를 옮길 때마다 깜빡인다.
    const previous = overlaysRef.current;
    const next = new Map<string, { signature: string; overlay: LiveOverlay; content: HTMLElement }>();

    markers.forEach((marker) => {
      const signature = markerSignature(marker, selectedMarkerId);
      const kept = previous.get(marker.id);
      if (kept !== undefined && kept.signature === signature) {
        kept.content.style.setProperty('--map-marker-scale', String(markerScale(marker, level)));
        previous.delete(marker.id);
        next.set(marker.id, kept);
        return;
      }
      if (kept !== undefined) {
        kept.overlay.setMap(null);
        previous.delete(marker.id);
      }
      const content = createMapMarkerElement(marker, selectedMarkerId, (selected) =>
        callbackRef.current.onSelectMarker?.(selected),
      );
      content.style.setProperty('--map-marker-scale', String(markerScale(marker, level)));
      next.set(marker.id, {
        signature,
        content,
        overlay: engine.createOverlay(map, marker, content, markerZIndex(marker, selectedMarkerId)),
      });
    });

    previous.forEach(({ overlay }) => overlay.setMap(null));
    overlaysRef.current = next;
  }, [engine, level, liveMode, mapReady, markers, selectedMarkerId, settledVersion]);

  useEffect(() => {
    const map = mapRef.current;
    if (!liveMode || !mapReady || map === null || gestureActiveRef.current) return;
    const signature = `${circleRadii}:${radiusCenter.latitude}:${radiusCenter.longitude}`;
    if (signature === circleSignatureRef.current) return;
    circleSignatureRef.current = signature;
    circlesRef.current.forEach((circle) => circle.setMap(null));
    circlesRef.current = (circleRadii === '' ? [] : circleRadii.split(',').map(Number)).map((radius) =>
      engine.createCircle(map, engine.latLng(radiusCenter.latitude, radiusCenter.longitude), radius),
    );
  }, [circleRadii, engine, liveMode, mapReady, radiusCenter.latitude, radiusCenter.longitude, settledVersion]);

  useEffect(() => {
    const map = mapRef.current;
    if (!liveMode || !mapReady || map === null || !coordinateAction) return;
    const content = document.createElement('div');
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = coordinateAction.label;
    button.disabled = coordinateAction.disabled ?? false;
    button.className = actionStyles.coordinateAction;
    if (coordinateAction.placement) button.dataset.placement = coordinateAction.placement;
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      coordinateAction.onClick();
    });
    content.append(button);
    const overlay = engine.createOverlay(
      map,
      {
        id: 'coordinate-action',
        label: coordinateAction.label,
        latitude: coordinateAction.latitude,
        longitude: coordinateAction.longitude,
      },
      content,
      30,
    );
    return () => overlay.setMap(null);
  }, [coordinateAction, engine, liveMode, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const sdk = window.naver?.maps;
    if (!liveMode || !mapReady || map === null || sdk === undefined) return;
    const layer = createMapRegionLayer(
      map,
      sdk,
      engine,
      (id) => regionCallbackRef.current?.(id),
      () => engine.getZoom(map),
    );
    regionLayerRef.current = layer;
    return () => {
      layer.dispose();
      if (regionLayerRef.current === layer) regionLayerRef.current = null;
    };
  }, [engine, liveMode, mapReady]);

  useEffect(() => {
    regionLayerRef.current?.sync(regions, selectedRegionId);
  }, [engine, liveMode, mapReady, regions, selectedRegionId, settledVersion]);

  return { containerRef, canvasRef, liveMode, sdkError, isLoading: liveMode && !renderReady && !sdkError };
};
export default useNaverMap;
