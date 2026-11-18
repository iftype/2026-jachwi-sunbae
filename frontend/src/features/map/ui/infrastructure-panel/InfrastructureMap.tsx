import { css } from '@emotion/css';
import { useMemo, useRef } from 'react';

import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';
import Icon from '@/shared/ui/icon/Icon';

import useInfrastructureLayer, { INFRASTRUCTURE_CATEGORIES } from '../../hooks/useInfrastructureLayer';
import { DESKTOP_FACILITY_MARKER_LEVEL, FACILITY_MARKER_LEVEL } from '../../lib/mapFacilityVisibility';
import type { MapBounds, MapMarker } from '../../model/Map';
import type { MapCanvasProps, MapRadiusCircle } from '../../model/MapCanvas';
import MapCanvasSurface from '../map-canvas/MapCanvasSurface';
import MapCategoryRail from '../map-category-rail/MapCategoryRail';

type Props = { mapProps: MapCanvasProps; open: boolean; onClose: () => void };

/** 시설을 보여 주는 반경. 매물 상세의 주변 지도와 같은 500m다. */
const INFRASTRUCTURE_RADIUS_METERS = 500 as const;
const METERS_PER_LATITUDE_DEGREE = 111_320;

const boundsAround = ({ latitude, longitude }: { latitude: number; longitude: number }): MapBounds => {
  const latitudeGap = INFRASTRUCTURE_RADIUS_METERS / METERS_PER_LATITUDE_DEGREE;
  const longitudeGap = latitudeGap / Math.cos((latitude * Math.PI) / 180);
  return {
    south: latitude - latitudeGap,
    north: latitude + latitudeGap,
    west: longitude - longitudeGap,
    east: longitude + longitudeGap,
  };
};

const isPropertyMarker = (marker: MapMarker) => marker.tone === 'property' || marker.tone === 'propertyCluster';
const squaredDistance = (marker: MapMarker, point: { latitude: number; longitude: number }) =>
  (marker.latitude - point.latitude) ** 2 + (marker.longitude - point.longitude) ** 2;

const InfrastructureMap = ({ mapProps, open }: Props) => {
  const center = useRef(mapProps.center);
  const isDesktop = useIsDesktop();
  const markerLevel = isDesktop ? DESKTOP_FACILITY_MARKER_LEVEL : FACILITY_MARKER_LEVEL;
  // 시설은 화면 범위나 확대 단계가 아니라 기준 매물 500m 안만 보여, 확대해도 나오는 자리가 달라지지 않는다.
  // 기준은 고른 매물, 없으면 지도 가운데에서 가장 가까운 매물이다.
  const anchor = useMemo(() => {
    const properties = (mapProps.markers ?? []).filter(isPropertyMarker);
    return (
      properties.find((marker) => marker.id === mapProps.selectedMarkerId) ??
      properties.reduce<MapMarker | null>(
        (nearest, marker) =>
          nearest === null || squaredDistance(marker, mapProps.center) < squaredDistance(nearest, mapProps.center)
            ? marker
            : nearest,
        null,
      )
    );
  }, [mapProps.markers, mapProps.selectedMarkerId, mapProps.center]);
  const anchorPoint = useMemo(
    () => (anchor === null ? null : { latitude: anchor.latitude, longitude: anchor.longitude }),
    [anchor?.latitude, anchor?.longitude],
  );
  const anchorBounds = useMemo(() => (anchorPoint === null ? null : boundsAround(anchorPoint)), [anchorPoint]);
  const circles = useMemo<MapRadiusCircle[] | undefined>(
    () => (open && anchorPoint ? [{ radiusMeters: INFRASTRUCTURE_RADIUS_METERS, label: '500m' }] : undefined),
    [open, anchorPoint],
  );
  const layer = useInfrastructureLayer(open, anchorBounds, 0, markerLevel);
  return (
    <>
      <MapCanvasSurface
        {...mapProps}
        circles={circles ?? mapProps.circles}
        radiusCenter={open && anchorPoint ? anchorPoint : mapProps.radiusCenter}
        markers={[...(mapProps.markers ?? []), ...layer.markers]}
        selectedMarkerId={open && layer.selected ? layer.selected.id : mapProps.selectedMarkerId}
        onCenterChange={(latitude, longitude) => {
          center.current = { latitude, longitude };
          mapProps.onCenterChange?.(latitude, longitude);
        }}
        onSelectMarker={(marker) => {
          if (open && layer.selectMarker(marker)) return;
          layer.clearSelection();
          mapProps.onSelectMarker?.(marker);
        }}
      />
      {open && (
        <>
          <MapCategoryRail
            className={styles.rail}
            showIcons={false}
            selectedCategories={layer.category ? [layer.category] : []}
            order={[...INFRASTRUCTURE_CATEGORIES]}
            labels={{ AGENCY: '중개사' }}
            onToggle={(category) => {
              if (
                category === 'AGENCY' ||
                category === 'HOSPITAL' ||
                category === 'TRANSPORT' ||
                category === 'CONVENIENCE'
              ) {
                layer.selectCategory(category);
              }
            }}
          />
          {anchor === null && layer.category && <p className={styles.hint}>매물을 고르면 500m 안 시설이 보여요</p>}
          {layer.isError && (
            <div className={styles.hint} role="alert">
              시설 정보를 불러오지 못했어요.{' '}
              <button type="button" onClick={() => void layer.retry()}>
                다시 시도
              </button>
            </div>
          )}
          {layer.selected && (
            <aside className={styles.info} aria-label="시설 정보 카드">
              <header>
                <h2>{layer.selected.name}</h2>
                <button type="button" aria-label="시설 정보 닫기" onClick={layer.clearSelection}>
                  <Icon name="close" size={20} />
                </button>
              </header>
              <p>{layer.selected.address || '지도에서 위치를 확인해 주세요.'}</p>
              {layer.selected.phone && <a href={`tel:${layer.selected.phone}`}>{layer.selected.phone}</a>}
            </aside>
          )}
        </>
      )}
    </>
  );
};
const styles = {
  rail: css`
    label: InfrastructureMap-rail;
    && {
      top: 10.5rem;
      right: 1.15rem;
      z-index: 35;
    }
    [data-desktop='false'] && {
      top: calc(max(0.85rem, env(safe-area-inset-top)) + 13.75rem);
      right: 0.95rem;
    }
  `,
  hint: css`
    label: InfrastructureMap-hint;
    position: absolute;
    z-index: 35;
    bottom: 5rem;
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    margin: 0;
    padding: 0.75rem;
    border-radius: 0.75rem;
    background: white;
    font-size: 0.8rem;
  `,
  info: css`
    label: InfrastructureMap-info;
    position: absolute;
    z-index: 45;
    bottom: 1.25rem;
    right: 5rem;
    width: min(20rem, calc(100% - 2rem));
    max-height: calc(100% - 6rem);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 1rem;
    border: 1px solid var(--color-border);
    border-radius: 1rem;
    background: white;
    box-shadow: var(--shadow-floating);
    & > header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    & h2 {
      margin: 0;
      font-size: 1rem;
    }
    & button {
      display: grid;
      place-items: center;
      border: 0;
      background: transparent;
      cursor: pointer;
    }
    & p {
      font-size: 0.85rem;
      color: var(--color-muted);
      line-height: 1.5;
    }
    [data-desktop='false'] & {
      bottom: 9rem;
      right: 1rem;
      max-height: 45%;
    }
  `,
};
export default InfrastructureMap;
