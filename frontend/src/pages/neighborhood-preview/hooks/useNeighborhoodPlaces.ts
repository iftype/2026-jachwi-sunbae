import { useMemo, useState } from 'react';

import { useViewportPlaces } from '@/features/map/api/useViewportPlaces';
import { viewportQuery } from '@/features/map/lib/mapViewportQuery';
import type { MapBounds, MapMarker, NearbyAgency } from '@/features/map/model/Map';

/**
 * 이 확대 단계(작을수록 가까움, 소수로도 온다)부터 화면 안의 정류장·부동산을 올린다. 축척 200m 화면 정도다.
 * 서버 반경은 최대 2km라 넓은 데스크탑 화면에서는 가운데 2km 안만 채워진다.
 */
export const PLACES_MAX_LEVEL = 6;

type BusStop = ReturnType<typeof useViewportPlaces>['busStops'][number];
/** 동네의 출발 정류장. 경로망 정류장 ID를 그대로 가진다. */
export type AreaStation = { stopId: string; name: string };
export type NeighborhoodPlace =
  | { kind: 'agency'; agency: NearbyAgency }
  | { kind: 'busStop'; busStop: BusStop }
  | { kind: 'station'; station: AreaStation };

export const placeTitle = (place: NeighborhoodPlace) =>
  place.kind === 'agency' ? place.agency.name : place.kind === 'busStop' ? place.busStop.name : place.station.name;

const AGENCY_PREFIX = 'agency:';
const BUS_STOP_PREFIX = 'bus-stop:';
const STATION_PREFIX = 'station:';

/**
 * 결과 지도에서 동네를 고르거나 가까이 확대하면 지금 화면 안의 버스정류장과 공인중개사를 지도에 올린다.
 * 동네를 고르면 지도가 그 동네로 옮겨 가므로, 그 화면 기준으로 바로 보여준다.
 * 둘 다 아니면 동네 경계만 남기고, 지도 이동이 끝날 때마다(idle) 화면 범위로 다시 조회한다. 같은 화면은 캐시를 쓴다.
 */
const useNeighborhoodPlaces = (enabled: boolean, hasSelectedArea: boolean) => {
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [station, setStation] = useState<AreaStation | null>(null);
  const isClose = enabled && (hasSelectedArea || (level !== null && level <= PLACES_MAX_LEVEL));
  const query = useMemo(() => (isClose && bounds ? viewportQuery(bounds) : null), [isClose, bounds]);
  const places = useViewportPlaces(query);
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
  const selectedPlace = useMemo<NeighborhoodPlace | null>(() => {
    if (!enabled || selectedId === null) return null;
    // 동네의 출발 정류장은 지도 화면과 상관없이 목록에서 고르므로 확대 여부와 무관하게 유지한다.
    if (selectedId.startsWith(STATION_PREFIX)) return station ? { kind: 'station', station } : null;
    if (!isClose) return null;
    if (selectedId.startsWith(AGENCY_PREFIX)) {
      const agency = places.agencies.find((item) => `${AGENCY_PREFIX}${item.providerPlaceId}` === selectedId);
      return agency ? { kind: 'agency', agency } : null;
    }
    const busStop = places.busStops.find((item) => `${BUS_STOP_PREFIX}${item.nodeId}` === selectedId);
    return busStop ? { kind: 'busStop', busStop } : null;
  }, [enabled, isClose, selectedId, station, places.agencies, places.busStops]);
  return {
    isClose,
    markers,
    selectedMarkerId: selectedPlace ? selectedId : null,
    selectedPlace,
    failed: places.agenciesFailed || places.busStopsFailed,
    /** 정류장·부동산 마커만 고른다. 다른 마커(목적지 등)는 무시한다. */
    selectMarker: (marker: MapMarker) => {
      if (marker.id.startsWith(AGENCY_PREFIX) || marker.id.startsWith(BUS_STOP_PREFIX)) setSelectedId(marker.id);
    },
    /** 동네 목록에서 출발 정류장을 고른다. */
    selectStation: (next: AreaStation) => {
      setStation(next);
      setSelectedId(`${STATION_PREFIX}${next.stopId}`);
    },
    closePlace: () => setSelectedId(null),
    rememberBounds: setBounds,
    rememberLevel: setLevel,
  };
};

export default useNeighborhoodPlaces;
