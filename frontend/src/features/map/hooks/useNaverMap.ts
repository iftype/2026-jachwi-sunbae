import { useEffect, useMemo, useRef, useState } from 'react';

import { usePublicConfig } from '@/shared/config/PublicConfigContext';
import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';

import { clampToSouthKorea } from '../lib/mapLocation';
import { createMapMarkerLayer } from '../lib/mapMarkerLayer';
import { COORDINATE_ACTION_Z_INDEX, COORDINATE_MENU_Z_INDEX } from '../lib/mapMarkerPresentation';
import { pinchLevelDelta } from '../lib/mapPinchZoom';
import { createMapRegionLayer, READY_TIMEOUT_MS } from '../lib/mapRegionLayer';
import { createMapTapGuard } from '../lib/mapTapGuard';
import {
  isNaverSdkAvailable,
  type LiveMap,
  type LiveOverlay,
  NAVER_AUTH_FAILURE_EVENT,
  naverEngine,
} from '../lib/naverMapEngine';
import type { MapCanvasProps } from '../model/MapCanvas';
import { createMapCoordinateMenuElement } from '../ui/map-coordinate-menu/MapCoordinateMenu';
import { createMapMarkerElement } from '../ui/map-marker/MapMarkerView';
import { createMapRegionCardElement } from '../ui/map-region-card/MapRegionCard';
import { createMapTipElement } from '../ui/map-tip/MapTip';

import * as actionStyles from '../ui/map-canvas/MapCanvas.styles';
const EMPTY_MARKERS: NonNullable<MapCanvasProps['markers']> = [];
const EMPTY_CIRCLES: NonNullable<MapCanvasProps['circles']> = [];
const EMPTY_REGIONS: NonNullable<MapCanvasProps['regions']> = [];
const EMPTY_ROUTES: NonNullable<MapCanvasProps['routes']> = [];
/** 시점 옮기기(morph 180ms)가 끝났다고 보는 최대 시간. 이 안에 목표에 못 닿은 idle은 중간 시점으로 본다. */
/** 정보 카드의 대략 높이(px). 위쪽 가장자리 근처에서 뒤집을지 가늠할 때 쓴다. */
const CARD_ESTIMATED_HEIGHT = 130;
const VIEW_SETTLE_MS = 450;

type LiveMapProps = Pick<
  MapCanvasProps,
  | 'center'
  | 'animateView'
  | 'coordinateAction'
  | 'coordinateMenu'
  | 'tip'
  | 'level'
  | 'customStyleId'
  | 'markers'
  | 'circles'
  | 'routes'
  | 'radiusCenter'
  | 'selectedMarkerId'
  | 'onSelectLocation'
  | 'onCenterChange'
  | 'onLevelChange'
  | 'onSelectMarker'
  | 'onBoundsChange'
  | 'onDragStart'
  | 'regions'
  | 'selectedRegionId'
  | 'onSelectRegion'
  | 'onHoverRegion'
>;

/** SDK의 수명과 동기화는 이 Hook에만 두고 화면은 지도 표현만 조립한다. */
const useNaverMap = ({
  center,
  animateView = false,
  coordinateAction,
  coordinateMenu,
  tip,
  level = 5,
  customStyleId,
  markers = EMPTY_MARKERS,
  circles = EMPTY_CIRCLES,
  routes = EMPTY_ROUTES,
  radiusCenter = center,
  selectedMarkerId = null,
  onSelectLocation,
  onCenterChange,
  onLevelChange,
  onSelectMarker,
  onBoundsChange,
  onDragStart,
  regions = EMPTY_REGIONS,
  selectedRegionId = null,
  onSelectRegion,
  onHoverRegion,
}: LiveMapProps) => {
  const config = usePublicConfig();
  const isDesktop = useIsDesktop();
  const [tapGuard] = useState(() => createMapTapGuard());
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LiveMap | null>(null);
  const markerLayerRef = useRef<ReturnType<typeof createMapMarkerLayer> | null>(null);
  const circlesRef = useRef<LiveOverlay[]>([]);
  const regionLayerRef = useRef<ReturnType<typeof createMapRegionLayer> | null>(null);
  const circleSignatureRef = useRef('');
  const callbackRef = useRef({
    onSelectLocation,
    onCenterChange,
    onLevelChange,
    onSelectMarker,
    onBoundsChange,
    onDragStart,
    tip,
  });
  const [mapReady, setMapReady] = useState(false);
  // SDK 로드와 GL 준비 사이에는 지도를 눌러도 반응이 없으므로 화면에 준비 중임을 알린다.
  const [renderReady, setRenderReady] = useState(false);
  // GL 지도는 준비를 마치기 전 좌표 변환이 한 단계 멀리 본 배율이라, 그때 넣은 마커는 모두 지도 가운데 쪽 절반 거리에
  // 그려졌다가 준비가 끝나면 제자리로 옮겨 간다. 마커, 좌표 버튼, 좌표 메뉴 같은 DOM 오버레이는 준비를 마친 뒤에 넣는다.
  const overlayReady = mapReady && renderReady;
  const canvasRef = useRef<HTMLDivElement>(null);
  const gestureActiveRef = useRef(false);
  // 화면이 시점을 옮기는 애니메이션(morph) 도중 지도 크기를 다시 맞추면 SDK가 애니메이션을 그 자리에서 멈춘다.
  // 동네를 고르며 옆 칸이 열려 지도 폭이 바뀌면 목표 확대 단계에 못 미쳐 정류장, 부동산 마커가 뜨지 않으므로
  // 애니메이션이 끝나는 idle까지 크기 맞춤을 미룬다.
  const viewAnimatingRef = useRef(false);
  const pendingRelayoutRef = useRef<(() => void) | null>(null);
  // 지도에 마지막으로 맞춘 칸 크기. 크기 맞춤은 크기가 달라졌을 때만 한다.
  const relaidSizeRef = useRef('');
  // 시점을 옮기기 시작한 시각과 목표. 옮기는 도중에 오는 idle(크기 맞춤 직후 등)을 다 옮긴 것으로 받지 않는다.
  const viewTargetRef = useRef<{ startedAt: number; latitude: number; longitude: number; level: number } | null>(null);
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
  const hoverCallbackRef = useRef(onHoverRegion);
  hoverCallbackRef.current = onHoverRegion;
  // 남한 밖 좌표를 받아도 지도는 남한 안만 비춘다.
  const boundedCenter = useMemo(() => clampToSouthKorea(center), [center.latitude, center.longitude]);
  const engine = useMemo(
    () => naverEngine(config.naverMapClientId ?? '', customStyleId),
    [config.naverMapClientId, customStyleId],
  );
  /** 지도 칸 크기가 마지막으로 맞춘 크기와 다르면 지도를 그 크기에 맞춘다. 크기가 0이면(숨김) 건너뛴다. */
  const relayoutIfResized = (map: LiveMap) => {
    const container = containerRef.current;
    if (container === null || container.clientWidth === 0 || container.clientHeight === 0) return;
    const size = `${container.clientWidth}x${container.clientHeight}`;
    if (size === relaidSizeRef.current) return;
    relaidSizeRef.current = size;
    engine.relayout(map);
    callbackRef.current.onBoundsChange?.(engine.getBounds(map));
  };
  const liveMode = config.mapProviderMode === 'naver' && (config.naverMapClientId ?? '') !== '';
  const initialViewRef = useRef({ center: boundedCenter, level });
  initialViewRef.current = { center: boundedCenter, level };
  const circleRadii = circles.map((circle) => circle.radiusMeters).join(',');

  callbackRef.current = {
    onSelectLocation,
    onCenterChange,
    onLevelChange,
    onSelectMarker,
    onBoundsChange,
    onDragStart,
    tip,
  };

  useEffect(() => {
    if (!liveMode || containerRef.current === null) return;
    let disposed = false;
    let map: LiveMap | null = null;
    let listeners: unknown[] = [];
    let readyFrame: number | null = null;
    let settleTimer: number | null = null;

    const handleAuthFailure = () => {
      // 폐기된 SDK를 호출하지 않고 지도만 중단하여 실제 API 목록·상세를 계속 사용할 수 있게 한다.
      if (readyFrame !== null) window.cancelAnimationFrame(readyFrame);
      readyFrame = null;
      mapRef.current = null;
      map = null;
      regionLayerRef.current?.dispose(true);
      regionLayerRef.current = null;
      markerLayerRef.current?.dispose(true);
      markerLayerRef.current = null;
      circlesRef.current = [];
      containerRef.current?.replaceChildren();
      setMapReady(false);
      setRenderReady(false);
      setSdkError(true);
    };
    window.addEventListener(NAVER_AUTH_FAILURE_EVENT, handleAuthFailure);
    setSdkError(false);
    setMapReady(false);
    setRenderReady(false);
    void engine
      .load()
      .then(() => {
        if (disposed || containerRef.current === null) return;
        map = engine.createMap(containerRef.current, initialViewRef.current.center, initialViewRef.current.level);
        mapRef.current = map;

        const handleIdle = () => {
          // 앞서 미뤄 둔 확인은 이 idle이 대신한다.
          if (settleTimer !== null) window.clearTimeout(settleTimer);
          settleTimer = null;
          if (disposed || map === null || !isNaverSdkAvailable()) return;
          // 시점을 옮기는 중간에 온 idle은 무시한다. 중간 좌표를 화면에 알리면 화면이 그 좌표로 다시 옮기라고 해
          // 목표와 중간 시점 사이를 오가며 튄다. 끝까지 오지 못하는 경우를 위해 일정 시간이 지나면 받는다.
          const target = viewTargetRef.current;
          if (target !== null) {
            const current = engine.getCenter(map);
            const arrived =
              Math.abs(current.latitude - target.latitude) < 0.000001 &&
              Math.abs(current.longitude - target.longitude) < 0.000001 &&
              Math.abs(engine.getZoom(map) - target.level) < 0.01;
            const waited = performance.now() - target.startedAt;
            if (!arrived && waited < VIEW_SETTLE_MS) {
              // 이 idle 뒤로 더 오지 않을 수 있으니(목표가 지도 경계에 걸리는 등) 기다릴 시간이 지나면 다시 받는다.
              settleTimer = window.setTimeout(handleIdle, VIEW_SETTLE_MS - waited);
              return;
            }
            viewTargetRef.current = null;
          }
          setGestureActive(false);
          viewAnimatingRef.current = false;
          const pendingRelayout = pendingRelayoutRef.current;
          pendingRelayoutRef.current = null;
          pendingRelayout?.();
          setSettledVersion((current) => current + 1);
          const nextCenter = engine.getCenter(map);
          callbackRef.current.onCenterChange?.(nextCenter.latitude, nextCenter.longitude);
          callbackRef.current.onLevelChange?.(engine.getZoom(map));
          const view = engine.getBounds(map);
          callbackRef.current.onBoundsChange?.(view);
          const currentTip = callbackRef.current.tip;
          if (
            currentTip !== undefined &&
            (currentTip.latitude < view.south ||
              currentTip.latitude > view.north ||
              currentTip.longitude < view.west ||
              currentTip.longitude > view.east)
          )
            currentTip.onOutOfView();
        };
        listeners.push(
          engine.addListener(map, 'dragstart', () => {
            tapGuard.block();
            // 옮기는 도중에 손으로 끌면 그 자리를 따른다.
            viewTargetRef.current = null;
            setGestureActive(true);
            callbackRef.current.onDragStart?.();
            callbackRef.current.tip?.onInteract();
          }),
          engine.addListener(map, 'zoomstart', () => {
            tapGuard.block();
            setGestureActive(true);
          }),
        );
        listeners.push(
          engine.addListener(map, 'click', (latitude, longitude) => {
            if (!tapGuard.allowsTap() || latitude === undefined || longitude === undefined) return;
            // 안내 말풍선은 지도의 다른 곳을 누르면 닫는다. 누름은 그대로 지도로 전한다.
            callbackRef.current.tip?.onInteract();
            callbackRef.current.onSelectLocation?.(latitude, longitude);
          }),
          engine.addListener(map, 'idle', handleIdle),
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
      window.removeEventListener(NAVER_AUTH_FAILURE_EVENT, handleAuthFailure);
      if (readyFrame !== null) window.cancelAnimationFrame(readyFrame);
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      listeners.forEach((listener) => engine.removeListener(listener));
      listeners = [];
      setGestureActive(false);
      viewAnimatingRef.current = false;
      markerLayerRef.current?.dispose(!isNaverSdkAvailable());
      markerLayerRef.current = null;
      if (isNaverSdkAvailable()) circlesRef.current.forEach((circle) => circle.setMap(null));
      circlesRef.current = [];
      circleSignatureRef.current = '';
      if (map !== null && isNaverSdkAvailable()) engine.destroy(map);
      mapRef.current = null;
    };
  }, [engine, liveMode]);

  useEffect(() => {
    if (animateView || !liveMode || !mapReady || mapRef.current === null || !isNaverSdkAvailable()) return;
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
    if (!animateView || !liveMode || !mapReady || map === null || !isNaverSdkAvailable()) return;
    const current = engine.getCenter(map);
    if (
      Math.abs(current.latitude - boundedCenter.latitude) < 0.0000001 &&
      Math.abs(current.longitude - boundedCenter.longitude) < 0.0000001 &&
      engine.getZoom(map) === level
    )
      return;
    // 옆 칸이 열리고 닫혀 지도 칸 크기가 바뀐 채로 옮기기 시작하면, 옛 크기로 옮긴 뒤 다 옮기고서야 크기를 맞춰
    // 화면이 한 번 더 튄다(넓어진 칸은 그동안 비어 보인다). 이미 바뀐 크기는 옮기기 전에 맞춘다.
    pendingRelayoutRef.current = null;
    relayoutIfResized(map);
    viewAnimatingRef.current = true;
    viewTargetRef.current = { startedAt: performance.now(), ...boundedCenter, level };
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
    const observer = new ResizeObserver(() => {
      if (relayoutFrame !== null) return;
      relayoutFrame = window.requestAnimationFrame(() => {
        relayoutFrame = null;
        const container = containerRef.current;
        if (
          container === null ||
          container.clientWidth === 0 ||
          container.clientHeight === 0 ||
          mapRef.current !== map ||
          !isNaverSdkAvailable()
        )
          return;
        if (`${container.clientWidth}x${container.clientHeight}` === relaidSizeRef.current) return;
        const relayout = () => {
          if (mapRef.current !== map || !isNaverSdkAvailable()) return;
          relayoutIfResized(map);
        };
        if (viewAnimatingRef.current) pendingRelayoutRef.current = relayout;
        else relayout();
      });
    });
    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      pendingRelayoutRef.current = null;
      if (relayoutFrame !== null) window.cancelAnimationFrame(relayoutFrame);
    };
  }, [engine, liveMode, mapReady]);

  // GL 지도에서 트랙패드 핀치(ctrl+휠)는 Naver 기본 처리가 손가락보다 훨씬 덜 움직여(deltaY -400에 0.64단계) 직접 받는다.
  // 손가락을 벌린 비율만큼 확대하고 커서 자리를 제자리에 둔다. ctrl 없는 휠과 터치 핀치는 SDK에 그대로 맡긴다.
  useEffect(() => {
    const container = containerRef.current;
    const map = mapRef.current;
    // GL이 아닌 지도는 확대 단계가 정수로만 바뀌어 손가락을 따라가는 소수 확대가 의미가 없다.
    // 직접 받으면 애니메이션 없이 툭툭 끊기므로, 스크롤 확대처럼 Naver 기본 처리(단계 사이 애니메이션)에 맡긴다.
    if (!liveMode || !mapReady || container === null || map === null || !customStyleId) return;
    let pending = 0;
    let offset = { x: 0, y: 0 };
    let frame: number | null = null;
    const apply = () => {
      frame = null;
      const delta = pending;
      pending = 0;
      if (delta === 0 || mapRef.current !== map || !isNaverSdkAvailable()) return;
      engine.zoomAround(map, delta, offset);
    };
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey || !isNaverSdkAvailable()) return;
      // SDK가 지원하지 않으면 기본 처리에 맡긴다.
      if (typeof map.zoomBy !== 'function') return;
      event.preventDefault();
      event.stopPropagation();
      const rect = container.getBoundingClientRect();
      offset = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      pending += pinchLevelDelta(event.deltaY, event.deltaMode);
      // 한 프레임에 온 이벤트는 모아 한 번만 옮긴다.
      frame ??= window.requestAnimationFrame(apply);
    };
    container.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => {
      container.removeEventListener('wheel', onWheel, { capture: true });
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [engine, liveMode, mapReady, customStyleId]);

  useEffect(() => {
    const map = mapRef.current;
    if (
      animateView ||
      !liveMode ||
      !mapReady ||
      map === null ||
      !isNaverSdkAvailable() ||
      engine.getZoom(map) === level
    )
      return;
    engine.setZoom(map, level);
  }, [engine, level, liveMode, mapReady, animateView]);

  useEffect(() => {
    const map = mapRef.current;
    if (!liveMode || !overlayReady || map === null || gestureActiveRef.current || !isNaverSdkAvailable()) return;
    // 달라진 마커만 다시 그린다. 전부 지웠다 만들면 지도를 옮길 때마다 깜빡인다.
    // 내린 마커는 레이어가 들고 있다가 같은 모양으로 다시 요청되면(탭을 오갈 때) 새로 만들지 않고 다시 붙인다.
    markerLayerRef.current ??= createMapMarkerLayer(map, engine, (marker, selected) =>
      createMapMarkerElement(marker, selected, (picked) => {
        if (tapGuard.allowsTap()) callbackRef.current.onSelectMarker?.(picked);
      }),
    );
    markerLayerRef.current.sync(markers, selectedMarkerId, level);
  }, [engine, level, liveMode, overlayReady, markers, selectedMarkerId, settledVersion]);

  useEffect(() => {
    const map = mapRef.current;
    if (!liveMode || !mapReady || map === null || gestureActiveRef.current || !isNaverSdkAvailable()) return;
    const signature = `${circleRadii}:${radiusCenter.latitude}:${radiusCenter.longitude}`;
    if (signature === circleSignatureRef.current) return;
    circleSignatureRef.current = signature;
    if (isNaverSdkAvailable()) circlesRef.current.forEach((circle) => circle.setMap(null));
    circlesRef.current = (circleRadii === '' ? [] : circleRadii.split(',').map(Number)).map((radius) =>
      engine.createCircle(map, engine.latLng(radiusCenter.latitude, radiusCenter.longitude), radius),
    );
  }, [circleRadii, engine, liveMode, mapReady, radiusCenter.latitude, radiusCenter.longitude, settledVersion]);

  // 선은 넘긴 배열이 바뀔 때만 다시 긋는다. 지도를 새로 만들면(SDK 인증 실패 뒤 다시 시도 등) 처음부터 긋는다.
  useEffect(() => {
    const map = mapRef.current;
    if (!liveMode || !mapReady || map === null || routes.length === 0 || !isNaverSdkAvailable()) return;
    const lines = routes.map((route) => engine.createPolyline(map, route));
    return () => {
      if (isNaverSdkAvailable()) lines.forEach((line) => line.setMap(null));
    };
  }, [engine, liveMode, mapReady, routes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!liveMode || !overlayReady || map === null || !coordinateAction || !isNaverSdkAvailable()) return;
    const content = document.createElement('div');
    if (coordinateAction.card) {
      // 카드가 화면 위쪽을 넘을 만큼 좌표가 위쪽 가장자리에 가까우면 마커 아래로 뒤집는다.
      const view = engine.getBounds(map);
      const height = containerRef.current?.clientHeight ?? 0;
      const fromTop = ((view.north - coordinateAction.latitude) / (view.north - view.south || 1)) * height;
      const needed = (coordinateAction.card.markerAbove ?? 0) + CARD_ESTIMATED_HEIGHT + 24;
      const flip = height > 0 && fromTop < needed;
      content.append(createMapRegionCardElement(coordinateAction.card, coordinateAction.onHoverChange, flip));
      const cardOverlay = engine.createOverlay(
        map,
        {
          id: 'coordinate-action',
          label: coordinateAction.card.title,
          latitude: coordinateAction.latitude,
          longitude: coordinateAction.longitude,
          tone: 'destination',
        },
        content,
        COORDINATE_ACTION_Z_INDEX,
      );
      return () => {
        if (isNaverSdkAvailable()) cardOverlay.setMap(null);
      };
    }
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
      COORDINATE_ACTION_Z_INDEX,
    );
    return () => {
      if (isNaverSdkAvailable()) overlay.setMap(null);
    };
  }, [coordinateAction, engine, liveMode, overlayReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!liveMode || !overlayReady || map === null || !coordinateMenu || !isNaverSdkAvailable()) return;
    const overlay = engine.createOverlay(
      map,
      {
        id: 'coordinate-menu',
        label: coordinateMenu.title ?? '',
        latitude: coordinateMenu.latitude,
        longitude: coordinateMenu.longitude,
        // 말풍선 꼬리 끝(요소 아래 가운데)이 좌표에 오게 말풍선 핀과 같은 기준으로 놓는다.
        tone: 'destination',
      },
      createMapCoordinateMenuElement(coordinateMenu),
      COORDINATE_MENU_Z_INDEX,
    );
    return () => {
      if (isNaverSdkAvailable()) overlay.setMap(null);
    };
  }, [coordinateMenu, engine, liveMode, overlayReady]);

  const tipLatitude = tip?.latitude;
  const tipLongitude = tip?.longitude;
  const tipMessage = tip?.message;
  const tipPlacement = tip?.placement;
  useEffect(() => {
    const map = mapRef.current;
    const current = callbackRef.current.tip;
    if (!liveMode || !overlayReady || map === null || current === undefined || !isNaverSdkAvailable()) return;
    const overlay = engine.createOverlay(
      map,
      { id: 'map-tip', label: current.message, latitude: current.latitude, longitude: current.longitude },
      // 확인 버튼은 바뀌지 않는 최신 콜백을 거쳐 부른다.
      createMapTipElement({ ...current, onConfirm: () => callbackRef.current.tip?.onConfirm() }),
      COORDINATE_MENU_Z_INDEX + 1,
    );
    return () => {
      if (isNaverSdkAvailable()) overlay.setMap(null);
    };
  }, [engine, liveMode, overlayReady, tipLatitude, tipLongitude, tipMessage, tipPlacement]);

  useEffect(() => {
    const map = mapRef.current;
    const sdk = window.naver?.maps;
    if (!liveMode || !mapReady || map === null || sdk == null || !isNaverSdkAvailable()) return;
    const layer = createMapRegionLayer(
      map,
      sdk,
      engine,
      (id, point) => {
        if (tapGuard.allowsTap()) regionCallbackRef.current?.(id, point);
      },
      () => engine.getZoom(map),
      (id, hovered) => hoverCallbackRef.current?.(id, hovered),
    );
    regionLayerRef.current = layer;
    return () => {
      layer.dispose(!isNaverSdkAvailable());
      if (regionLayerRef.current === layer) regionLayerRef.current = null;
    };
  }, [engine, liveMode, mapReady]);

  useEffect(() => {
    regionLayerRef.current?.sync(regions, selectedRegionId, !isDesktop);
  }, [engine, isDesktop, liveMode, mapReady, regions, selectedRegionId, settledVersion]);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const down = (event: PointerEvent) => tapGuard.start(event.pointerId, event.clientX, event.clientY);
    const move = (event: PointerEvent) => tapGuard.move(event.pointerId, event.clientX, event.clientY);
    const up = (event: PointerEvent) => tapGuard.end(event.pointerId);
    const cancel = (event: PointerEvent) => tapGuard.end(event.pointerId, true);
    const wheel = () => tapGuard.block();
    element.addEventListener('pointerdown', down, true);
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', cancel, true);
    element.addEventListener('wheel', wheel, { capture: true, passive: true });
    return () => {
      element.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', cancel, true);
      element.removeEventListener('wheel', wheel, true);
      tapGuard.reset();
    };
  }, [tapGuard]);

  return { containerRef, canvasRef, tapGuard, liveMode, sdkError, isLoading: liveMode && !renderReady && !sdkError };
};
export default useNaverMap;
