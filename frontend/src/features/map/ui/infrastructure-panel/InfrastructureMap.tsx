import { css } from '@emotion/css';
import { useEffect, useMemo, useRef, useState } from 'react';

import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';

import useInfrastructureLayer from '../../hooks/useInfrastructureLayer';
import {
  DESKTOP_MAP_CONTROLS_RIGHT,
  DESKTOP_MAP_RAIL_TOP,
  MOBILE_MAP_CONTROLS_RIGHT,
  MOBILE_MAP_RAIL_TOP,
} from '../../lib/mapControlsLayout';
import {
  DESKTOP_FACILITY_MARKER_LEVEL,
  FACILITY_MARKER_LEVEL,
  facilityMarkersVisible,
} from '../../lib/mapFacilityVisibility';
import { FACILITY_CATEGORY_COLOR, isFacilityCategory } from '../../lib/mapPresentation';
import type { MapBounds, MapMarker } from '../../model/Map';
import type { MapCanvasProps, MapCoordinateMenu, MapRadiusCircle } from '../../model/MapCanvas';
import MapBookmarkToggle from '../map-bookmark-toggle/MapBookmarkToggle';
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

/** 좌표에서 시설 핀 위쪽 가장자리까지의 높이(px). 핀(2.3rem)을 가리지 않게 말풍선을 그만큼 올린다. */
const FACILITY_PIN_HEIGHT = 37;
/** 멀리서 점으로만 보일 때 점 반지름 정도만 올린다. */
const FACILITY_DOT_RADIUS = 6;

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
          color:
            marker.category && isFacilityCategory(marker.category)
              ? FACILITY_CATEGORY_COLOR[marker.category]
              : undefined,
        }))
      : [];
  }, [layer.markers, anchorPoint, isNear, isDesktop]);
  // 눌린 시설 마커 위에 이름만 띄운다. 중개업소는 전화번호가 있을 때만 전화 걸기를 더한다.
  const facilityMenu = useMemo<MapCoordinateMenu | undefined>(() => {
    const place = layer.selected;
    if (!open || anchorPoint === null || place === null) return undefined;
    const phone = place.category === 'AGENCY' ? place.phone?.trim() : undefined;
    return {
      latitude: place.latitude,
      longitude: place.longitude,
      title: place.name,
      heading: place.name,
      markerAbove: isNear ? FACILITY_PIN_HEIGHT : FACILITY_DOT_RADIUS,
      actions: phone
        ? [{ id: 'call', label: '전화', href: `tel:${phone}`, ariaLabel: `${place.name} 전화걸기`, onSelect: () => {} }]
        : [],
    };
  }, [open, anchorPoint, layer.selected, isNear]);
  return (
    <>
      <MapCanvasSurface
        {...mapProps}
        circles={circles ?? mapProps.circles}
        radiusCenter={open && anchorPoint ? anchorPoint : mapProps.radiusCenter}
        coordinateMenu={facilityMenu ?? mapProps.coordinateMenu}
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
        onSelectLocation={
          mapProps.onSelectLocation || layer.selected
            ? (latitude, longitude) => {
                layer.clearSelection();
                mapProps.onSelectLocation?.(latitude, longitude);
              }
            : undefined
        }
        onSelectMarker={(marker) => {
          // 열린 말풍선의 마커를 다시 누르면 닫는다.
          if (open && layer.selected?.id === marker.id) {
            layer.clearSelection();
            return;
          }
          if (open && layer.selectMarker(marker)) return;
          layer.clearSelection();
          mapProps.onSelectMarker?.(marker);
        }}
      />
      {mapProps.bookmarkControl && <MapBookmarkToggle {...mapProps.bookmarkControl} />}
      {open && anchor !== null && (
        <>
          <MapCategoryRail
            className={styles.rail}
            showIcons={false}
            selectedCategories={layer.category ? [layer.category] : []}
            hiddenCategories={['SCHOOL']}
            onToggle={(category) => {
              if (isFacilityCategory(category)) layer.selectCategory(category);
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
        </>
      )}
    </>
  );
};
const styles = {
  /* 시설 분류 카드의 자리와 간격은 시트나 찜 버튼에 연동하지 않는다. */
  rail: css`
    label: InfrastructureMap-rail;
    && {
      top: ${DESKTOP_MAP_RAIL_TOP};
      right: ${DESKTOP_MAP_CONTROLS_RIGHT};
      z-index: 35;
    }
    [data-desktop='false'] && {
      top: ${MOBILE_MAP_RAIL_TOP};
      right: ${MOBILE_MAP_CONTROLS_RIGHT};
    }
  `,
  hint: css`
    label: InfrastructureMap-hint;
    position: absolute;
    z-index: 35;
    bottom: 5rem;
    /* 데스크탑은 떠 있는 패널을 뺀 보이는 지도 칸의 가운데에 둔다. */
    left: calc(50% + var(--map-panel-width, 0px) / 2);
    transform: translateX(-50%);
    white-space: nowrap;
    margin: 0;
    padding: 0.75rem;
    border-radius: 0.75rem;
    background: white;
    font-size: 0.8rem;
  `,
};
export default InfrastructureMap;
