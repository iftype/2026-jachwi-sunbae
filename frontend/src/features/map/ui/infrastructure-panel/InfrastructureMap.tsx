import { css } from '@emotion/css';
import { useEffect, useMemo, useRef, useState } from 'react';

import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';
import Icon from '@/shared/ui/icon/Icon';

import useInfrastructureLayer, { INFRASTRUCTURE_CATEGORIES } from '../../hooks/useInfrastructureLayer';
import {
  DESKTOP_FACILITY_MARKER_LEVEL,
  FACILITY_MARKER_LEVEL,
  facilityMarkersVisible,
} from '../../lib/mapFacilityVisibility';
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

/** 두 좌표 사이의 거리(m). 500m는 짧아 평면 근사로 충분하다. */
const distanceMeters = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const northSouth = (a.latitude - b.latitude) * METERS_PER_LATITUDE_DEGREE;
  const eastWest = (a.longitude - b.longitude) * METERS_PER_LATITUDE_DEGREE * Math.cos((b.latitude * Math.PI) / 180);
  return Math.hypot(northSouth, eastWest);
};

/** 멀리서 점으로 줄일 때 쓰는 시설별 색. 매물 상세 주변 지도의 색과 같다. */
const DOT_COLOR: Partial<Record<NonNullable<MapMarker['category']>, string>> = {
  TRANSPORT: '#3b82f6',
  CONVENIENCE: '#22c55e',
  HOSPITAL: '#ef4444',
  AGENCY: '#f59e0b',
};

const isPropertyMarker = (marker: MapMarker) => marker.tone === 'property' || marker.tone === 'propertyCluster';

const InfrastructureMap = ({ mapProps, open }: Props) => {
  const [observedLevel, setObservedLevel] = useState(mapProps.level ?? 8);
  useEffect(() => setObservedLevel(mapProps.level ?? 8), [mapProps.level]);
  const center = useRef(mapProps.center);
  const isDesktop = useIsDesktop();
  const markerLevel = isDesktop ? DESKTOP_FACILITY_MARKER_LEVEL : FACILITY_MARKER_LEVEL;
  // 시설은 화면 범위나 확대 단계에 따라 달라지지 않게, 고른 매물 500m 안만 보여 준다. 매물을 고르지 않았으면 분류 레일도 두지 않는다.
  const anchor = useMemo(
    () =>
      (mapProps.markers ?? []).find((marker) => marker.id === mapProps.selectedMarkerId && isPropertyMarker(marker)) ??
      null,
    [mapProps.markers, mapProps.selectedMarkerId],
  );
  const anchorPoint = useMemo(
    () => (anchor === null ? null : { latitude: anchor.latitude, longitude: anchor.longitude }),
    [anchor?.latitude, anchor?.longitude],
  );
  const anchorBounds = useMemo(() => (anchorPoint === null ? null : boundsAround(anchorPoint)), [anchorPoint]);
  const layer = useInfrastructureLayer(open, anchorBounds, 0, markerLevel);
  // 500m 범위는 시설을 보고 있을 때만 그린다.
  const circles = useMemo<MapRadiusCircle[] | undefined>(
    () =>
      open && anchorPoint && layer.category !== null
        ? [{ radiusMeters: INFRASTRUCTURE_RADIUS_METERS, label: '500m' }]
        : undefined,
    [open, anchorPoint, layer.category],
  );
  // 받아 온 시설은 네모 범위라 모서리와 칸 경계 밖의 것이 섞인다. 원 안(500m)에 든 것만 그린다.
  const isNear = facilityMarkersVisible(observedLevel, markerLevel);
  const facilityMarkers = useMemo<MapMarker[]>(() => {
    if (anchorPoint === null) return [];
    const inside = layer.markers.filter(
      (marker) => distanceMeters(marker, anchorPoint) <= INFRASTRUCTURE_RADIUS_METERS,
    );
    if (isNear) return inside;
    // 멀리 축소하면 핀 대신 작은 색 점으로만 남긴다. 화면이 넓은 데스크탑만 보여 준다.
    return isDesktop
      ? inside.map((marker) => ({
          ...marker,
          tone: 'dot' as const,
          color: marker.category ? DOT_COLOR[marker.category] : undefined,
        }))
      : [];
  }, [layer.markers, anchorPoint, isNear, isDesktop]);
  return (
    <>
      <MapCanvasSurface
        {...mapProps}
        circles={circles ?? mapProps.circles}
        radiusCenter={open && anchorPoint ? anchorPoint : mapProps.radiusCenter}
        markers={[...(mapProps.markers ?? []), ...facilityMarkers]}
        selectedMarkerId={open && layer.selected ? layer.selected.id : mapProps.selectedMarkerId}
        onCenterChange={(latitude, longitude) => {
          center.current = { latitude, longitude };
          mapProps.onCenterChange?.(latitude, longitude);
        }}
        onLevelChange={(next) => {
          setObservedLevel(next);
          mapProps.onLevelChange?.(next);
        }}
        onSelectMarker={(marker) => {
          if (open && layer.selectMarker(marker)) return;
          layer.clearSelection();
          mapProps.onSelectMarker?.(marker);
        }}
      />
      {open && anchor !== null && (
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
      /* 현재 위치(10.55rem) 버튼 바로 아래. */
      top: 13.7rem;
      right: 1.15rem;
      z-index: 35;
    }
    [data-desktop='false'] && {
      top: calc(max(0.85rem, env(safe-area-inset-top)) + 16.95rem);
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
