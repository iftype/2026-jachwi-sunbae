import type { CSSProperties } from 'react';
import { useMemo } from 'react';

import StatusPanel from '@/shared/ui/status-panel/StatusPanel';

import useNaverMap from '../../hooks/useNaverMap';
import { clampToSouthKorea } from '../../lib/mapLocation';
import { markerScale } from '../../lib/mapMarkerPresentation';
import { regionLabelPosition, regionSummaryRows } from '../../lib/mapRegionSummary';
import type { MapMarker } from '../../model/Map';
import type { MapCanvasProps } from '../../model/MapCanvas';
import MapMarkerView from '../map-marker/MapMarkerView';

import styles from './MapCanvas.module.css';
import summaryStyles from './MapRegionSummary.module.css';

const EMPTY_MARKERS: MapMarker[] = [];
const EMPTY_CIRCLES: NonNullable<MapCanvasProps['circles']> = [];
const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const demoMarkerStyle = (marker: MapMarker, center: { latitude: number; longitude: number }): CSSProperties => ({
  transform:
    marker.tone === 'property' || marker.tone === 'selected'
      ? 'translate(-50%, -120.710678%)'
      : 'translate(-50%, -50%)',
  left: `${clamp(50 + (marker.longitude - center.longitude) * 3_100, 9, 91)}%`,
  top: `${clamp(50 - (marker.latitude - center.latitude) * 4_200, 10, 88)}%`,
});

const MapCanvas = ({
  center,
  animateView = false,
  coordinateAction,
  markers = EMPTY_MARKERS,
  circles = EMPTY_CIRCLES,
  level = 5,
  customStyleId,
  interactive = false,
  showCenterPin = false,
  showRadiusLabels = false,
  selectedMarkerId = null,
  onSelectMarker,
  onSelectLocation,
  onCenterChange,
  onLevelChange,
  onBoundsChange,
  radiusCenter = center,
  regions,
  selectedRegionId,
  onSelectRegion,
}: MapCanvasProps) => {
  const boundedCenter = useMemo(() => clampToSouthKorea(center), [center.latitude, center.longitude]);
  const { containerRef, canvasRef, liveMode, sdkError } = useNaverMap({
    center,
    animateView,
    coordinateAction,
    markers,
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
    regions,
    selectedRegionId,
    onSelectRegion,
  });

  return (
    <div
      className={`${styles.canvas} ${liveMode ? styles.live : styles.demo}`}
      ref={canvasRef}
      aria-label={liveMode ? 'Naver 지도' : '데모 지도'}
      onClick={(event) => {
        if (liveMode || !interactive || onSelectLocation === undefined) return;
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
                    region.appearance
                      ? region.id === selectedRegionId
                        ? 0.38
                        : 0.28
                      : region.id === selectedRegionId
                        ? 0.5
                        : region.isRecommended
                          ? 0.24
                          : 0.08
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
          {markers.map((marker) => {
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
      {sdkError && (
        <div className={styles.mapError}>
          <StatusPanel title="지도를 연결할 수 없어요." description="잠시 후 다시 시도해 주세요." tone="error" />
        </div>
      )}
    </div>
  );
};

export default MapCanvas;
