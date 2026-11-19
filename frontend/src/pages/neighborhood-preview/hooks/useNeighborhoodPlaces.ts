import { useMemo, useRef, useState } from 'react';

import { useViewportPlaces } from '@/features/map/api/useViewportPlaces';
import { FACILITY_MARKER_LEVEL, facilityMarkersVisible } from '@/features/map/lib/mapFacilityVisibility';
import { stationVariant } from '@/features/map/lib/mapIconAssets';
import type { MapBounds, MapMarker, NearbyAgency, NearbyPlace } from '@/features/map/model/Map';
import useDebouncedValue from '@/shared/lib/hooks/useDebouncedValue';

import type { MyPropertyRow } from '../model/myProperty';

type BusStop = ReturnType<typeof useViewportPlaces>['busStops'][number];
/** 동네의 출발 정류장. 경로망 정류장 ID를 그대로 가지고, 고르면 지도를 그 자리로 옮긴다. */
export type AreaStation = { stopId: string; name: string; latitude: number; longitude: number };
export type NeighborhoodPlace =
  | { kind: 'agency'; agency: NearbyAgency }
  | { kind: 'busStop'; busStop: BusStop }
  | { kind: 'station'; station: AreaStation }
  /** 분류 레일로 켠 병원, 편의점 마커. */
  | { kind: 'facility'; facility: NearbyPlace }
  /** 레일 `My`로 올린 내 매물 마커. */
  | { kind: 'property'; property: MyPropertyRow };

export const placeTitle = (place: NeighborhoodPlace) =>
  place.kind === 'agency'
    ? place.agency.name
    : place.kind === 'busStop'
      ? place.busStop.name
      : place.kind === 'station'
        ? place.station.name
        : place.kind === 'property'
          ? place.property.name
          : place.facility.name;

const NO_AGENCIES: NearbyAgency[] = [];
const AGENCY_PREFIX = 'agency:';
const BUS_STOP_PREFIX = 'bus-stop:';
const STATION_PREFIX = 'station:';
/** 분류 레일 시설 마커 id의 머리(`placeMarkers`가 붙인다). */
const FACILITY_PREFIX = 'place-';
/** 내 매물 마커 id의 머리. */
export const MY_PROPERTY_PREFIX = 'my-property:';

/**
 * 결과 지도를 가까이 확대하면 지금 화면 안의 버스정류장과 공인중개사를 지도에 올린다.
 * 동네를 고르면 그 동네로 다가가므로 바로 보이고, 전체 결과를 볼 때처럼 멀면 동네 경계와 색만 남긴다.
 * 지도 이동이 끝날 때마다(idle) 화면 범위로 다시 조회하고, 같은 화면은 캐시를 쓴다.
 */
/**
 * 가까이 확대했을 때 화면 안에서 받을 것을 고른다. 동네 찾기 결과 지도는 레일에서 켠 분류(중개사 또는 교통)만 받는다.
 * 지도가 멈춘 뒤 잠깐 기다렸다가(`BOUNDS_DEBOUNCE_MS`) 조회해, 손으로 여러 번 옮길 때 중간 화면마다 요청하지 않는다.
 */
const BOUNDS_DEBOUNCE_MS = 300;
const useNeighborhoodPlaces = (
  enabled: boolean,
  {
    loadsAgencies = true,
    loadsBusStops = true,
    markerLevel = FACILITY_MARKER_LEVEL,
  }: { loadsAgencies?: boolean; loadsBusStops?: boolean; markerLevel?: number } = {},
) => {
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [isNear, setIsNear] = useState(false);
  // 지도는 멈출 때마다(idle) 확대 단계와 범위를 알린다. 범위는 가까이 확대해 정류장, 부동산을 조회할 때만 쓰므로
  // 멀리 볼 때는 ref에만 기억하고 상태로 올리지 않는다. 그래야 멀리서 지도를 옮길 때 동네 찾기 화면 전체가 다시 그려지지 않는다.
  const nearRef = useRef(false);
  const latestBoundsRef = useRef<MapBounds | null>(null);
  // 마지막으로 상태에 올린 범위. 같은 범위로 다시 멈추면 상태를 건드리지 않는다.
  const shownBoundsRef = useRef<MapBounds | null>(null);
  const showBounds = (next: MapBounds | null) => {
    const current = shownBoundsRef.current;
    if (
      current === next ||
      (current !== null &&
        next !== null &&
        current.south === next.south &&
        current.west === next.west &&
        current.north === next.north &&
        current.east === next.east)
    )
      return;
    shownBoundsRef.current = next;
    setBounds(next);
  };
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [station, setStation] = useState<AreaStation | null>(null);
  const [facility, setFacility] = useState<NearbyPlace | null>(null);
  // 결과 지도가 아닌 동안(다시 고르기, 분석 중)은 지도가 확대 단계와 범위를 알려 주지 않는다.
  // 결과 지도를 떠날 때 기억한 값을 비워, 돌아온 지도가 멈추기 전에 예전 확대 단계로 마커를 올리지 않게 한다.
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (wasEnabled !== enabled) {
    setWasEnabled(enabled);
    if (!enabled) {
      nearRef.current = false;
      latestBoundsRef.current = null;
      shownBoundsRef.current = null;
      setIsNear(false);
      setBounds(null);
    }
  }
  const isClose = enabled && isNear;
  // 멀면 요청하지 않는다. 가까우면 지도가 멈춘 뒤 잠깐 기다린 화면 범위로 켠 것만 받는다.
  const settledBounds = useDebouncedValue(isClose ? bounds : null, BOUNDS_DEBOUNCE_MS);
  const places = useViewportPlaces(settledBounds, { agencies: loadsAgencies, busStops: loadsBusStops });
  const markers = useMemo<MapMarker[]>(
    () =>
      isClose
        ? [
            ...places.busStops.map((stop) => ({
              id: `${BUS_STOP_PREFIX}${stop.nodeId}`,
              latitude: stop.latitude,
              longitude: stop.longitude,
              label: stop.name,
              tone: 'place' as const,
              category: 'TRANSPORT' as const,
              actionable: true,
            })),
            ...places.agencies.map((agency) => ({
              id: `${AGENCY_PREFIX}${agency.providerPlaceId}`,
              latitude: agency.latitude,
              longitude: agency.longitude,
              label: agency.name,
              tone: 'place' as const,
              category: 'AGENCY' as const,
              actionable: true,
            })),
          ]
        : [],
    [isClose, places.busStops, places.agencies],
  );
  // 목록에서 고른 출발 정류장은 확대 단계와 상관없이 지도에 따로 찍어 어디인지 보여 준다.
  const stationMarker = useMemo<MapMarker[]>(
    () =>
      enabled && station && selectedId === `${STATION_PREFIX}${station.stopId}`
        ? [
            {
              id: selectedId,
              latitude: station.latitude,
              longitude: station.longitude,
              label: station.name,
              tone: 'place' as const,
              category: 'TRANSPORT' as const,
              variant: stationVariant(station.stopId),
              // 누르면 지도 빈 곳 누르기로 넘어가 열어 둔 경로를 닫지 않게, 고른 정류장 그대로 둔다.
              actionable: true,
            },
          ]
        : [],
    [enabled, station, selectedId],
  );
  // 마커 배열은 바뀔 때만 새로 만든다. 렌더마다 새 배열이면 지도가 마커를 매번 다시 맞춘다.
  const allMarkers = useMemo(
    () => (stationMarker.length ? [...markers, ...stationMarker] : markers),
    [markers, stationMarker],
  );
  const selectedPlace = useMemo<NeighborhoodPlace | null>(() => {
    if (!enabled || selectedId === null) return null;
    // 동네의 출발 정류장은 지도 화면과 상관없이 목록에서 고르므로 확대 여부와 무관하게 유지한다.
    if (selectedId.startsWith(STATION_PREFIX)) return station ? { kind: 'station', station } : null;
    // 분류 레일 시설은 지도 화면 범위로 따로 받으므로 확대 여부와 무관하게 고른 것을 유지한다.
    if (selectedId.startsWith(FACILITY_PREFIX)) {
      if (!facility) return null;
      // 레일의 교통 마커는 버스 정류장이라, 그 정류장에서 출퇴근 장소까지 경로를 보여 준다.
      if (facility.category === 'TRANSPORT')
        return {
          kind: 'busStop',
          busStop: {
            nodeId: facility.providerPlaceId,
            name: facility.name,
            latitude: facility.latitude,
            longitude: facility.longitude,
            distanceMeters: facility.distanceMeters,
          },
        };
      return { kind: 'facility', facility };
    }
    if (!isClose) return null;
    if (selectedId.startsWith(AGENCY_PREFIX)) {
      const agency = places.agencies.find((item) => `${AGENCY_PREFIX}${item.providerPlaceId}` === selectedId);
      return agency ? { kind: 'agency', agency } : null;
    }
    const busStop = places.busStops.find((item) => `${BUS_STOP_PREFIX}${item.nodeId}` === selectedId);
    return busStop ? { kind: 'busStop', busStop } : null;
  }, [enabled, isClose, selectedId, station, facility, places.agencies, places.busStops]);
  return {
    isClose,
    markers: allMarkers,
    selectedMarkerId: selectedPlace ? selectedId : null,
    selectedPlace,
    failed: places.agenciesFailed || places.busStopsFailed,
    /** 지금 화면 범위의 공인중개사. 공인중개사는 동네 단위로 받을 수 없어 화면 기준 목록으로 쓴다. 멀리 보면 비운다. */
    agencies: isClose ? places.agencies : NO_AGENCIES,
    /** 정류장·부동산 마커만 고른다. 다른 마커(목적지 등)는 무시한다. */
    selectMarker: (marker: MapMarker) => {
      if (
        marker.id.startsWith(AGENCY_PREFIX) ||
        marker.id.startsWith(BUS_STOP_PREFIX) ||
        (station !== null && marker.id === `${STATION_PREFIX}${station.stopId}`)
      )
        setSelectedId(marker.id);
    },
    /** 분류 레일로 올린 시설 마커를 고른다. */
    selectFacility: (marker: MapMarker, place: NearbyPlace) => {
      setFacility(place);
      setSelectedId(marker.id);
    },
    /** 동네 목록에서 출발 정류장을 고른다. */
    selectStation: (next: AreaStation) => {
      setStation(next);
      setSelectedId(`${STATION_PREFIX}${next.stopId}`);
    },
    closePlace: () => setSelectedId(null),
    bounds,
    rememberBounds: (next: MapBounds) => {
      latestBoundsRef.current = next;
      if (nearRef.current) showBounds(next);
    },
    /** 지도가 멈춘 확대 단계. 지도는 범위(`rememberBounds`)보다 먼저 알린다. */
    rememberLevel: (level: number) => {
      const near = facilityMarkersVisible(level, markerLevel);
      // 같은 값으로 상태를 다시 넣어도 React가 한 번 더 렌더할 수 있어 바뀔 때만 넣는다.
      if (near !== nearRef.current) setIsNear(near);
      nearRef.current = near;
      // 가까이 다가간 순간에는 이미 기억한 범위로 바로 조회를 시작한다. 멀어지면 범위는 쓰지 않는다.
      if (near) showBounds(latestBoundsRef.current);
    },
  };
};

export default useNeighborhoodPlaces;
