import type { CSSProperties } from 'react';
import { useEffect, useMemo } from 'react';

import useDelayedLoading from '@/shared/lib/hooks/useDelayedLoading';
import { Button } from '@/shared/ui/button/Button';
import ProgressCircle from '@/shared/ui/progress-circle/ProgressCircle';

import useNaverMap from '../../hooks/useNaverMap';
import { readCurrentLocation, useCurrentLocation } from '../../lib/currentLocationStore';
import { clampToSouthKorea, requestCurrentMapLocation } from '../../lib/mapLocation';
import { mapZoomScale, markerAnchorTransform, markerScale } from '../../lib/mapMarkerPresentation';
import { regionLabelPosition, regionSummaryRows } from '../../lib/mapRegionSummary';
import type { MapMarker } from '../../model/Map';
import type { MapCanvasProps } from '../../model/MapCanvas';
import MapCoordinateMenu from '../map-coordinate-menu/MapCoordinateMenu';
import MapMarkerView from '../map-marker/MapMarkerView';

import * as styles from './MapCanvas.styles';
import * as summaryStyles from './MapRegionSummary.styles';

const EMPTY_MARKERS: MapMarker[] = [];
const CURRENT_LOCATION_MARKER_ID = 'current-location';
const EMPTY_CIRCLES: NonNullable<MapCanvasProps['circles']> = [];
const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const demoMarkerStyle = (marker: MapMarker, center: { latitude: number; longitude: number }): CSSProperties => ({
  transform: markerAnchorTransform(marker),
  left: `${clamp(50 + (marker.longitude - center.longitude) * 3_100, 9, 91)}%`,
  top: `${clamp(50 - (marker.latitude - center.latitude) * 4_200, 10, 88)}%`,
});

const MapCanvas = ({
  center,
  onRetry,
  onReady,
  animateView = false,
  coordinateAction,
  hoverAction,
  coordinateMenu,
  tip,
  markers = EMPTY_MARKERS,
  circles = EMPTY_CIRCLES,
  level = 5,
  customStyleId,
  interactive = false,
  showCenterPin = false,
  hideLoading = false,
  showRadiusLabels = false,
  selectedMarkerId = null,
  onSelectMarker: onSelectMarkerProp,
  onSelectLocation,
  onCenterChange,
  onLevelChange,
  onBoundsChange,
  onDragStart,
  radiusCenter = center,
  regions,
  selectedRegionId,
  onSelectRegion: onSelectRegionProp,
  onHoverRegion,
}: MapCanvasProps) => {
  // 첫 안내 말풍선은 지도의 다른 곳을 누르는 것과 같이, 마커나 구역을 눌러도 확인을 기다리지 않고 닫힌다.
  const onSelectMarker = onSelectMarkerProp
    ? (marker: MapMarker) => {
        tip?.onInteract();
        onSelectMarkerProp(marker);
      }
    : undefined;
  const onSelectRegion = onSelectRegionProp
    ? (...args: Parameters<NonNullable<MapCanvasProps['onSelectRegion']>>) => {
        tip?.onInteract();
        onSelectRegionProp(...args);
      }
    : undefined;
  // 내 현재 위치는 모든 지도에서 파란 점으로 보인다. 위치 권한이 이미 허용돼 있으면 조용히 한 번 받아 온다.
  const currentLocation = useCurrentLocation();
  useEffect(() => {
    if (readCurrentLocation() !== null) return;
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((status) => (status.state === 'granted' ? requestCurrentMapLocation() : undefined))
      .catch(() => undefined);
  }, []);
  const allMarkers = useMemo<MapMarker[]>(
    () =>
      currentLocation === null
        ? markers
        : [
            ...markers,
            {
              id: CURRENT_LOCATION_MARKER_ID,
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              label: '현재 위치',
              tone: 'current',
            },
          ],
    [markers, currentLocation],
  );
  const boundedCenter = useMemo(() => clampToSouthKorea(center), [center.latitude, center.longitude]);
  const { containerRef, canvasRef, tapGuard, liveMode, sdkError, isLoading } = useNaverMap({
    center,
    animateView,
    coordinateAction,
    hoverAction,
    coordinateMenu,
    tip,
    markers: allMarkers,
    circles,
    radiusCenter,
    level,
    customStyleId,
    selectedMarkerId,
    onSelectLocation,
    onCenterChange,
    onLevelChange,
    onSelectMarker,
    onBoundsChange,
    onDragStart,
    regions,
    selectedRegionId,
    onSelectRegion,
    onHoverRegion,
  });
  // 지도가 금방 준비되면 불러오는 중 안내 없이 바로 보여 주고, 오래 걸릴 때만 알린다.
  const isMapLoadingVisible = useDelayedLoading(isLoading);
  useEffect(() => {
    if (!isLoading && !sdkError) onReady?.();
  }, [isLoading, sdkError, onReady]);

  return (
    <div
      className={liveMode ? styles.canvas : `${styles.canvas} ${styles.demo}`}
      ref={canvasRef}
      data-map-zoom-area=""
      aria-label={liveMode ? 'Naver 지도' : '데모 지도'}
      onClick={(event) => {
        if (liveMode || !interactive || !tapGuard.allowsTap() || onSelectLocation === undefined) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const picked = clampToSouthKorea({
          latitude: boundedCenter.latitude + (0.5 - (event.clientY - rect.top) / rect.height) * 0.018,
          longitude: boundedCenter.longitude + ((event.clientX - rect.left) / rect.width - 0.5) * 0.024,
        });
        onSelectLocation(picked.latitude, picked.longitude);
      }}
    >
      {liveMode && (
        <div className={styles.liveLayer}>
          <div ref={containerRef} className={styles.liveMap} />
        </div>
      )}
      {!liveMode && (
        <>
          <span className={styles.roadOne} />
          <span className={styles.roadTwo} />
          <span className={styles.park}>MOCA PARK</span>
          {coordinateAction && (
            <button
              className={styles.coordinateAction}
              data-placement={coordinateAction.placement}
              style={{
                ...demoMarkerStyle({ ...coordinateAction, id: 'coordinate-action' }, boundedCenter),
                bottom: 'auto',
                transform:
                  coordinateAction.placement === 'above' ? 'translate(-50%, -100%)' : 'translate(1.5rem, -3rem)',
              }}
              disabled={coordinateAction.disabled}
              onClick={(event) => {
                event.stopPropagation();
                coordinateAction.onClick();
              }}
            >
              {coordinateAction.label}
            </button>
          )}
          {coordinateMenu && (
            <div
              className={styles.coordinateMenu}
              style={demoMarkerStyle(
                { ...coordinateMenu, id: 'coordinate-menu', label: '', tone: 'destination' },
                boundedCenter,
              )}
              onClick={(event) => event.stopPropagation()}
            >
              <MapCoordinateMenu menu={coordinateMenu} />
            </div>
          )}
          {regions !== undefined && (
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
              aria-label="구역 경계 시안"
            >
              {regions.map((region) => (
                <path
                  key={region.id}
                  d={(region.polygons?.flat() ?? region.paths)
                    .map(
                      (path) =>
                        path
                          .map(
                            (point, index) =>
                              `${index === 0 ? 'M' : 'L'}${50 + (point.longitude - boundedCenter.longitude) * 3100},${50 - (point.latitude - boundedCenter.latitude) * 4200}`,
                          )
                          .join(' ') + 'Z',
                    )
                    .join(' ')}
                  fill={
                    region.appearance?.fillColor ??
                    (region.isRecommended === false && region.id !== selectedRegionId ? '#888888' : '#f5c344')
                  }
                  fillOpacity={
                    region.appearance?.fillOpacity ??
                    (region.appearance
                      ? region.id === selectedRegionId
                        ? 0.55
                        : 0.28
                      : region.id === selectedRegionId
                        ? 0.5
                        : region.isRecommended
                          ? 0.24
                          : 0.08)
                  }
                  fillRule="evenodd"
                  className={styles.regionBoundary}
                  stroke={region.appearance?.strokeColor ?? (region.id === selectedRegionId ? '#787b80' : '#a4a7ab')}
                  strokeWidth={
                    region.appearance
                      ? region.id === selectedRegionId
                        ? '0.2'
                        : '0.125'
                      : region.id === selectedRegionId
                        ? '0.3'
                        : '0.2'
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectRegion?.(region.id);
                  }}
                >
                  <title>{region.name}</title>
                </path>
              ))}
            </svg>
          )}
          {regions
            ?.filter((region) => region.summary)
            .map((region) => (
              <button
                key={region.id}
                className={summaryStyles.summary}
                aria-label={`${region.name} ${regionSummaryRows(region)
                  .map(([label]) => label)
                  .join('과 ')}`}
                aria-pressed={region.id === selectedRegionId}
                data-colored={region.appearance !== undefined || undefined}
                style={{
                  ...{ '--map-region-scale': mapZoomScale(level) },
                  ...(region.appearance ? { '--region-accent': region.appearance.strokeColor } : {}),
                  ...demoMarkerStyle(
                    { id: region.id, label: region.name, ...regionLabelPosition(region) },
                    boundedCenter,
                  ),
                  position: 'absolute',
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectRegion?.(region.id);
                }}
              >
                <strong>{region.name}</strong>
                <span className={summaryStyles.cells}>
                  {regionSummaryRows(region).map(([label, value]) => (
                    <span key={label}>
                      <small>{label}</small>
                      <b>{value}</b>
                    </span>
                  ))}
                </span>
              </button>
            ))}
          {circles.map((circle) => (
            <span
              key={circle.radiusMeters}
              className={styles.radiusCircle}
              style={{
                width: `${(circle.radiusMeters / 2000) * 84}%`,
                left: `${50 + (radiusCenter.longitude - boundedCenter.longitude) * 3_100}%`,
                top: `${50 - (radiusCenter.latitude - boundedCenter.latitude) * 4_200}%`,
              }}
              aria-hidden="true"
            />
          ))}
          {allMarkers.map((marker) => {
            return (
              <div
                key={marker.id}
                className={styles.demoMarkerPosition}
                style={
                  {
                    ...demoMarkerStyle(marker, boundedCenter),
                    '--map-marker-scale': markerScale(marker, level),
                  } as CSSProperties
                }
              >
                <MapMarkerView marker={marker} selectedMarkerId={selectedMarkerId} onSelectMarker={onSelectMarker} />
              </div>
            );
          })}
          <span className={styles.demoBadge}>DEMO MAP</span>
        </>
      )}
      {showCenterPin && (
        <span className={styles.fixedCenterPin} aria-label="선택할 지도 중심" role="img">
          <span aria-hidden="true">+</span>
        </span>
      )}
      {showRadiusLabels && (
        <div className={styles.radiusLabels} aria-hidden="true">
          {circles
            .slice()
            .reverse()
            .map((circle) => (
              <span key={circle.radiusMeters}>{circle.label}</span>
            ))}
        </div>
      )}
      {isMapLoadingVisible && !hideLoading && (
        <div className={styles.mapLoading}>
          <ProgressCircle size={24} label="지도를 불러오는 중이에요." />
        </div>
      )}
      {sdkError && (
        <div className={styles.mapError} role="alert">
          <strong>지도를 연결할 수 없어요.</strong>
          <p>잠시 후 다시 시도해 주세요.</p>
          {onRetry && (
            <Button variant="secondary" onClick={onRetry}>
              지도 다시 시도
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default MapCanvas;
