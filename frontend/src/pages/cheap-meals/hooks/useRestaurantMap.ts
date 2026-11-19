import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { useGoodPriceStores } from '@/features/good-price/api/goodPriceApi';
import {
  coordinatesAreClose,
  DEFAULT_MAP_CENTER,
  isInSouthKorea,
  type MapCoordinate,
  requestCurrentMapLocation,
} from '@/features/map/lib/mapLocation';
import type { MapMarker } from '@/features/map/model/Map';
import { usePropertyList } from '@/features/property/api/useProperties';
import {
  hiddenPreviewSnapshot,
  parseHiddenPreviewIds,
  subscribeHiddenPreviews,
} from '@/features/property/model/previewPropertyDismissal';
import { withPreviewProperties } from '@/features/property/model/sampleProperties';

import { countBusinessTypes, filterByBusinessType } from '../model/businessTypeFilter';
import {
  readRestaurantArea,
  readRestaurantListOpen,
  writeRestaurantArea,
  writeRestaurantListOpen,
} from '../model/restaurantAreaSession';
import { RESTAURANT_SEARCH_RADIUS, type RestaurantArea } from '../model/RestaurantMap';
import useRestaurantOverlay from './useRestaurantOverlay';

const DEFAULT_AREA: RestaurantArea = { ...DEFAULT_MAP_CENTER, label: '판교 주변' };
const NOTICE_MS = 3000;
const BASE_MARKER_ID = 'restaurant-base';
const PROPERTY_MARKER_PREFIX = 'record-property:';

/** 위치 권한을 이미 허용했을 때만 true. 화면에 들어오자마자 권한 창을 띄우지 않으려고 먼저 확인한다. */
const hasLocationPermission = async (): Promise<boolean> => {
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state === 'granted';
  } catch {
    return false;
  }
};

/**
 * 식당 탭의 기준 위치. 기준 마커 하나가 검색 반경(원)과 거리 정렬의 중심이다.
 * 현재 위치가 기본이고(권한이 있을 때), 지도의 기록 매물 마커를 누르면 그 매물이 기준이 된다. 마커를 끌어 옮기지는 않는다.
 */
const useRestaurantMap = (isActive: boolean) => {
  const overlay = useRestaurantOverlay();
  // 새로고침하면 이 탭에서 마지막으로 고른 기준으로 돌아와, 주소에 남은 가게(`?store=`)를 같은 목록에서 다시 연다.
  const hadStoredArea = useRef(readRestaurantArea() !== null);
  const [area, setArea] = useState<RestaurantArea>(() => readRestaurantArea() ?? DEFAULT_AREA);
  const [viewport, setViewport] = useState<MapCoordinate>(area);
  const [level, setLevel] = useState(7);
  const [isListOpen, setIsListOpen] = useState(() => overlay.selectedStoreId !== null || readRestaurantListOpen());
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  // 기준이 바뀌었을 때 잠깐 보여 주는 안내.
  const [notice, setNotice] = useState<string | null>(null);
  // 고른 업종. null이면 모든 업종을 보여 준다. 기준을 바꿔도 그대로 두어 같은 업종을 이어서 찾는다.
  const [businessType, setBusinessType] = useState<string | null>(null);
  const properties = usePropertyList(isActive);
  // 기록이 하나도 없으면 내 기록 화면과 같은 미리보기(예시) 매물을 대신 쓰고, 이 기기에서 숨긴 예시는 뺀다.
  const hiddenPreviewValue = useSyncExternalStore(subscribeHiddenPreviews, hiddenPreviewSnapshot);
  const hiddenPreviewIds = useMemo(() => parseHiddenPreviewIds(hiddenPreviewValue), [hiddenPreviewValue]);
  /** 위치가 있는 기록 매물. 목록 순서(최근 기록 먼저)를 따른다. 이름이 같으면 주소로 구분한다. */
  const recorded = useMemo(() => {
    const listed = withPreviewProperties(
      properties.data?.pages.flatMap((page) => page.content) ?? [],
      properties.isSuccess,
    ).properties.filter((property) => !hiddenPreviewIds.includes(property.propertyId));
    const located = listed.flatMap((property) =>
      property.location.latitude === null || property.location.longitude === null
        ? []
        : [
            {
              id: property.propertyId,
              name: property.name,
              address: property.location.address,
              latitude: property.location.latitude,
              longitude: property.location.longitude,
            },
          ],
    );
    const nameCounts = new Map<string, number>();
    for (const property of located) nameCounts.set(property.name, (nameCounts.get(property.name) ?? 0) + 1);
    return located.map((property) => ({
      ...property,
      label:
        (nameCounts.get(property.name) ?? 0) > 1 && property.address
          ? `${property.name}(${property.address})`
          : property.name,
    }));
  }, [properties.data, properties.isSuccess, hiddenPreviewIds]);
  const requestId = useRef(0);
  // 사용자가 기준을 직접 고르면 뒤늦게 도착한 현재 위치나 기록 매물이 그 기준을 덮지 않는다.
  const hasChosen = useRef(false);
  const showNotice = (text: string) => setNotice(text);
  useEffect(() => {
    if (notice === null) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    setIsLocating(false);
    return () => {
      requestId.current += 1;
    };
  }, [isActive]);
  useEffect(() => {
    writeRestaurantArea(area);
  }, [area]);
  useEffect(() => {
    writeRestaurantListOpen(isListOpen);
  }, [isListOpen]);
  // 기준이 정해진 적이 없으면 가장 최근에 기록한 매물을 기준으로 삼는다. 현재 위치가 먼저 정해졌으면 그대로 둔다.
  const hasAppliedBase = useRef(false);
  useEffect(() => {
    const first = recorded[0];
    if (hasAppliedBase.current || hasChosen.current || hadStoredArea.current || first === undefined) return;
    hasAppliedBase.current = true;
    const base = { latitude: first.latitude, longitude: first.longitude, label: first.label };
    setArea(base);
    setViewport(base);
  }, [recorded]);
  const query = useGoodPriceStores(area, RESTAURANT_SEARCH_RADIUS, isActive);
  const selectedStore = query.data?.stores.find((store) => String(store.id) === overlay.selectedStoreId) ?? null;
  // 지금 동네 목록에 없는 가게 주소(다른 기기나 오래된 세션에서 연 상세 등)는 열 수 없으니 주소에서 지운다.
  // 동네를 바꾸는 동안 이전 목록(placeholder)으로는 판단하지 않는다.
  const isStoreMissing =
    isActive &&
    overlay.selectedStoreId !== null &&
    query.isSuccess &&
    !query.isPlaceholderData &&
    selectedStore === null;
  const { forgetStore } = overlay;
  useEffect(() => {
    if (isStoreMissing) forgetStore();
  }, [isStoreMissing, forgetStore]);
  const businessTypes = useMemo(
    () => countBusinessTypes(query.data?.stores ?? [], businessType),
    [query.data, businessType],
  );
  const stores = useMemo(
    () => filterByBusinessType(query.data?.stores ?? [], businessType),
    [query.data, businessType],
  );
  const markers = useMemo<MapMarker[]>(
    () => [
      // 기록 매물은 작은 공용 매물 핀으로 보인다. 기준과 같은 자리의 매물은 기준 마커가 대신한다.
      ...recorded
        .filter((property) => !coordinatesAreClose(property, area))
        .map((property) => ({
          id: `${PROPERTY_MARKER_PREFIX}${property.id}`,
          latitude: property.latitude,
          longitude: property.longitude,
          label: `${property.label} 기준으로 보기`,
          tone: 'property' as const,
          compact: true,
          actionable: true,
        })),
      ...stores.map((store) => ({
        id: String(store.id),
        latitude: store.latitude,
        longitude: store.longitude,
        label: store.name,
        tone: 'destination' as const,
        actionable: true,
      })),
      // 기준 마커. 진한 파란 핀에 작은 `기준` 라벨. 가게와 매물 마커보다 위에 그려지지만 눌리지는 않는다.
      {
        id: BASE_MARKER_ID,
        latitude: area.latitude,
        longitude: area.longitude,
        label: '기준',
        tone: 'pinLabel' as const,
        pinKind: 'commute' as const,
      },
    ],
    [recorded, stores, area],
  );
  const chooseArea = (next: RestaurantArea) => {
    requestId.current += 1;
    setIsLocating(false);
    setLocationError(null);
    setArea(next);
    setViewport(next);
    setIsListOpen(true);
    overlay.closeOverlay();
  };
  /** 기록한 매물 하나를 기준으로 삼는다. 줌은 그대로 두고 지도 중심만 그 매물로 옮긴다. */
  const chooseProperty = (id: number) => {
    const property = recorded.find((candidate) => candidate.id === id);
    if (property === undefined) return;
    hasChosen.current = true;
    chooseArea({ latitude: property.latitude, longitude: property.longitude, label: property.label });
    showNotice(`${property.label} 기준으로 보고 있어요`);
  };
  const locate = async (options: { announce?: boolean } = {}) => {
    const id = ++requestId.current;
    setIsLocating(true);
    setLocationError(null);
    try {
      const coordinate = await requestCurrentMapLocation();
      if (id !== requestId.current) return;
      if (!isInSouthKorea(coordinate)) throw new Error('국내 위치가 필요합니다.');
      hasChosen.current = true;
      chooseArea({ ...coordinate, label: '현재 위치' });
      if (options.announce !== false) showNotice('현재 위치 기준으로 보고 있어요');
    } catch {
      if (id === requestId.current) {
        setIsLocating(false);
        setLocationError('현재 위치를 확인하지 못했어요. 위치 권한을 확인해 주세요.');
      }
    }
  };
  // 위치 권한이 이미 있으면 현재 위치를 기준으로 시작한다. 없거나 실패하면 마지막 기준, 가장 최근 기록 매물, 기본 위치 순으로 쓴다.
  const hasTriedStartLocation = useRef(false);
  useEffect(() => {
    if (!isActive || hasTriedStartLocation.current) return;
    hasTriedStartLocation.current = true;
    let isCancelled = false;
    void hasLocationPermission().then((isGranted) => {
      if (isCancelled || !isGranted || hasChosen.current) return;
      void requestCurrentMapLocation()
        .then((coordinate) => {
          if (isCancelled || hasChosen.current || !isInSouthKorea(coordinate)) return;
          hasChosen.current = true;
          setArea({ ...coordinate, label: '현재 위치' });
          setViewport(coordinate);
        })
        .catch(() => undefined);
    });
    return () => {
      isCancelled = true;
    };
  }, [isActive]);
  /** 지금 기준과 같은 자리의 기록 매물. 기록 매물 줄에서 고른 칸으로 보여 준다. */
  const baseProperty = recorded.find((property) => coordinatesAreClose(property, area)) ?? null;
  return {
    area,
    recorded,
    baseProperty,
    notice,
    closeNotice: () => setNotice(null),
    viewport,
    radius: RESTAURANT_SEARCH_RADIUS,
    level,
    query,
    stores,
    businessType,
    businessTypes,
    selectBusinessType: setBusinessType,
    markers,
    selectedStore,
    isListOpen,
    isLocating,
    locationError,
    chooseProperty,
    locate: () => locate(),
    changeLevel: setLevel,
    openList: () => setIsListOpen(true),
    closeList: () => setIsListOpen(false),
    // 지도가 멈출 때마다 불린다. 지도를 끌어도 기준은 바뀌지 않고, 지도 시점만 따라간다.
    moveMap: (latitude: number, longitude: number) => {
      const next = { latitude, longitude };
      if (coordinatesAreClose(viewport, next)) return;
      setViewport(next);
    },
    /** 지도 마커를 눌렀을 때. 매물 마커는 기준으로 삼고, 가게 마커는 상세를 연다. 기준 마커는 눌러도 아무 일도 없다. */
    selectMarker: (markerId: string) => {
      if (markerId === BASE_MARKER_ID) return;
      if (markerId.startsWith(PROPERTY_MARKER_PREFIX)) {
        chooseProperty(Number(markerId.slice(PROPERTY_MARKER_PREFIX.length)));
        return;
      }
      const store = query.data?.stores.find((candidate) => String(candidate.id) === markerId);
      if (!store) return;
      setViewport(store);
      setIsListOpen(true);
      overlay.openStore(store.id);
    },
    openStore: (id: number) => {
      const store = query.data?.stores.find((store) => store.id === id);
      if (!store) return;
      setViewport(store);
      setIsListOpen(true);
      overlay.openStore(id);
    },
    closeOverlay: () => {
      requestId.current += 1;
      setIsLocating(false);
      overlay.closeOverlay();
    },
  };
};
export default useRestaurantMap;
