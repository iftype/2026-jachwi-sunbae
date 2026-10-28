import { useMemo, useState } from 'react';

import { reverseGeocode } from '@/features/map/api/mapApi';
import { useNearbyFacilities } from '@/features/map/api/useNearbyFacilities';
import { clusterNearbyPlaces } from '@/features/map/lib/mapClustering';
import { SERVICE_MAP_STYLE_ID } from '@/features/map/lib/mapStyle';
import { isInBounds, viewportQuery } from '@/features/map/lib/mapViewportQuery';
import type { MapAddress, MapBounds, MapCategory, MapMarker } from '@/features/map/model/Map';
import type { MapCanvasProps, MapCoordinateMenu, MapTapAction } from '@/features/map/model/MapCanvas';
import useStreetMemoLayer from '@/features/street-memo/hooks/useStreetMemoLayer';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';

import type { RecordsState } from './useRecords';

const TAP_MARKER_ID = 'tap-point';
const NO_CATEGORIES: MapCategory[] = [];

type MapPoint = { latitude: number; longitude: number };

type Options = {
  /**
   * 찍은 위치에서 매물 등록을 고르면 주소를 찾아 넘긴다. 주소를 못 찾으면 좌표만 넘긴다. 등록 화면을 여는 방식은 화면이 정한다.
   * 넘기지 않으면 찍은 위치에서는 메모만 남긴다. 휴대폰은 찍은 위치 동작을 쓰지 않고 추가 버튼으로 따로 남긴다.
   */
  onRegister?: (location: MapAddress) => void;
  /** 처음 켜 둘 카테고리. 휴대폰은 거리 메모를 켠 채로 연다. */
  initialCategory?: MapCategory | null;
};

const sameBounds = (a: MapBounds | null, b: MapBounds) =>
  a !== null && a.south === b.south && a.north === b.north && a.west === b.west && a.east === b.east;

/**
 * 본 방 기록 지도 위에 얹는 인프라 겹. 예전 인프라 지도의 시설 카테고리·거리 메모와 찍은 위치의 동작을 맡는다.
 * 시설은 반경 원 없이 지금 지도 화면 안의 것만 보여주고, 카테고리는 한 번에 하나만 켠다.
 * 데스크탑·휴대폰 지도가 함께 쓰고, 지도 위 조작을 어디에 어떻게 놓을지는 각 화면의 지도 컴포넌트가 정한다.
 */
const useRecordsMapLayers = (records: RecordsState, { onRegister, initialCategory = null }: Options) => {
  const config = usePublicConfig();
  const { level } = records;
  const hasSelection = records.selected !== undefined;
  const closeSelection = () => records.setSelectedId(null);
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [category, setCategory] = useState<MapCategory | null>(initialCategory);
  const [tapPoint, setTapPoint] = useState<MapPoint | null>(null);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const memo = useStreetMemoLayer(category === 'MEMO', bounds);

  const facilityCategory = category !== null && category !== 'MEMO' ? category : null;
  const query = useMemo(() => (bounds ? viewportQuery(bounds) : null), [bounds]);
  const selectedCategories = facilityCategory === null ? NO_CATEGORIES : [facilityCategory];
  const nearby = useNearbyFacilities(
    query?.center ?? { latitude: 0, longitude: 0 },
    query?.radius ?? 500,
    selectedCategories,
    query !== null && facilityCategory !== null,
  );
  const visiblePlaces = useMemo(
    () => (bounds ? nearby.data.places.filter((place) => isInBounds(place, bounds)) : []),
    [nearby.data.places, bounds],
  );
  const counts = useMemo(() => {
    const result: Partial<Record<MapCategory, number>> = {};
    visiblePlaces.forEach((place) => {
      result[place.category] = (result[place.category] ?? 0) + 1;
    });
    return result;
  }, [visiblePlaces]);
  const facilityMarkers = useMemo(
    () =>
      clusterNearbyPlaces(
        visiblePlaces.filter((place) => place.category === facilityCategory),
        level,
      ),
    [visiblePlaces, facilityCategory, level],
  );
  const markers = useMemo<MapMarker[]>(
    () => [
      ...facilityMarkers,
      ...memo.markers,
      ...(tapPoint === null
        ? []
        : [{ ...tapPoint, id: TAP_MARKER_ID, label: '선택한 위치', tone: 'destination' as const }]),
    ],
    [facilityMarkers, memo.markers, tapPoint],
  );

  const registerAt = (point: MapPoint) => {
    setTapPoint(null);
    setIsResolvingAddress(true);
    const fallback: MapAddress = { address: null, roadAddress: null, jibunAddress: null, ...point };
    reverseGeocode(config, point.latitude, point.longitude)
      .then(
        (address) => onRegister?.({ ...address, ...point }),
        () => onRegister?.(fallback),
      )
      .finally(() => setIsResolvingAddress(false));
  };
  const tapActions: MapTapAction[] =
    tapPoint === null
      ? []
      : [
          {
            id: 'street-memo',
            label: '📝 메모 남기기',
            onSelect: () => {
              setTapPoint(null);
              closeSelection();
              memo.startDraft(tapPoint);
            },
          },
          ...(onRegister
            ? [{ id: 'property', label: '🏠 여기에 매물 등록', onSelect: () => registerAt(tapPoint) }]
            : []),
        ];

  const selectMarker = (marker: MapMarker): boolean => {
    if (!memo.selectMarker(marker)) return false;
    setTapPoint(null);
    closeSelection();
    return true;
  };
  /**
   * 빈 곳을 찍으면, 열린 매물·메모·동작 버튼이 있으면 닫기만 하고 아니면 그 자리에서 할 일을 고르게 한다.
   * 무언가를 닫으려고 찍었는데 바로 새 동작이 뜨면 다시 닫아야 해서 두 단계로 나눈다.
   */
  const tapLocation = (latitude: number, longitude: number) => {
    if (hasSelection || memo.mode !== null || tapPoint !== null) {
      closeSelection();
      memo.close();
      setTapPoint(null);
      return;
    }
    setTapPoint({ latitude, longitude });
  };
  /** 지도를 옮기면 화면 범위를 다시 조회하고, 찍어 둔 위치의 동작은 거둔다. */
  const rememberBounds = (next: MapBounds) => {
    if (sameBounds(bounds, next)) return;
    setBounds(next);
    setTapPoint(null);
  };
  const allMarkers = useMemo(() => [...records.markers, ...markers], [records.markers, markers]);
  /** 두 화면의 지도가 그대로 넘기는 MapCanvas 설정. 찍은 자리 말풍선(coordinateMenu)은 데스크탑만 더한다. */
  const canvasProps = {
    customStyleId: SERVICE_MAP_STYLE_ID,
    center: records.center,
    level: records.level,
    markers: allMarkers,
    selectedMarkerId: records.selected?.id ?? memo.selectedMarkerId,
    // 메모 마커가 아니면 기록한 방 마커다. 시설 마커는 누를 수 없다.
    onSelectMarker: (marker: MapMarker) => {
      if (selectMarker(marker)) return;
      memo.close();
      setTapPoint(null);
      records.setSelectedId(marker.id);
    },
    onSelectLocation: tapLocation,
    onCenterChange: (latitude: number, longitude: number) => records.setCenter({ latitude, longitude }),
    onLevelChange: records.setLevel,
    onBoundsChange: rememberBounds,
  } satisfies MapCanvasProps;

  return {
    canvasProps,
    category,
    counts,
    memo,
    tapPoint,
    tapActions,
    isResolvingAddress,
    facilitiesFailed: facilityCategory !== null && nearby.isError,
    coordinateMenu: (tapPoint === null
      ? undefined
      : { ...tapPoint, actions: tapActions, onClose: () => setTapPoint(null) }) satisfies MapCoordinateMenu | undefined,
    /** 같은 카테고리를 다시 누르면 끈다. */
    toggleCategory: (next: MapCategory) => setCategory((current) => (current === next ? null : next)),
    /** 메모를 남기면 메모가 보이도록 메모 카테고리를 켠다. */
    showMemos: () => setCategory('MEMO'),
    closeTap: () => setTapPoint(null),
    /** 열어 둔 매물·메모·찍은 위치를 모두 닫는다. 휴대폰 추가 모드에 들어갈 때 쓴다. */
    closeAll: () => {
      closeSelection();
      memo.close();
      setTapPoint(null);
    },
  };
};

export type RecordsMapLayers = ReturnType<typeof useRecordsMapLayers>;

export default useRecordsMapLayers;
