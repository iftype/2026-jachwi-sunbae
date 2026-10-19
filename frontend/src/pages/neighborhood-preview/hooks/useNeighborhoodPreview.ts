import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { ApiError } from '@/features/auth/api/apiClient';
import { commuteAreaToRegion } from '@/features/map/api/commuteApi';
import { fetchCommuteRoute } from '@/features/map/api/commuteRouteApi';
import { fetchLegalBoundaries, nearbyLegalBoundaries } from '@/features/map/api/legalBoundaryApi';
import { reverseGeocode, searchAddress } from '@/features/map/api/mapApi';
import { fetchRentalAverage } from '@/features/map/api/rentalApi';
import { useCommuteAreas } from '@/features/map/api/useCommuteAreas';
import { readGeolocationPermission, requestCurrentMapLocation } from '@/features/map/lib/mapLocation';
import { type MapCoordinate, MapLocationError } from '@/features/map/lib/mapLocation';
import type { MapAddress } from '@/features/map/model/Map';
import { completeExploration, startExploration } from '@/features/onboarding/lib/explorationJourney';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';

import { commuteBand, commuteColor } from '../model/commuteColors';
import { readNeighborhoodSearch, writeNeighborhoodSearch } from '../model/neighborhoodSearchSession';
import { PREVIEW_DESTINATION } from '../model/preview';
import { resultMapCenter } from '../model/resultMapView';
import useNeighborhoodAnalytics from './useNeighborhoodAnalytics';

const describeError = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.code === 'COMMUTE_DESTINATION_UNREACHABLE')
      return '목적지에서 걸어서 10분 안에 이용할 수 있는 정류장·역이 없습니다.';
    if (error.code === 'TRANSIT_NETWORK_UNAVAILABLE')
      return '대중교통 정보를 준비하고 있습니다. 잠시 후 다시 시도해 주세요.';
    if (error.code === 'ADMIN_DONG_NOT_FOUND') return '행정동을 찾을 수 없습니다.';
    if (error.code === 'ACCESS_TOKEN_INVALID')
      return '통근 서버가 인증을 요구하고 있어요. 머지된 공개 API가 dev 서버에 배포됐는지 확인이 필요합니다.';
  }
  return '정보를 불러오지 못했어요. 다시 시도해주세요.';
};
const describeRouteError = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.code === 'COMMUTE_ROUTE_NOT_FOUND') return '현재 조건에 맞는 경로를 찾지 못했어요.';
    if (error.code === 'TRANSIT_STOP_NOT_FOUND') return '선택한 정류장을 찾지 못했어요.';
    if (error.code === 'COMMUTE_DESTINATION_UNREACHABLE') return '목적지 근처에 이용할 정류장이 없어요.';
  }
  return '경로를 불러오지 못했어요. 다른 정류장을 선택해 보세요.';
};

const useNeighborhoodPreview = () => {
  const config = usePublicConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const client = useQueryClient();
  const isMockData = config.commuteDataSource === 'mock';
  const [query, setQuery] = useState('');
  const isPublicExplore = location.pathname.startsWith('/explore/');
  const mode: 'commute' | 'price' = (
    isPublicExplore ? location.pathname.startsWith('/explore/price') : searchParams.get('mode') === 'price'
  )
    ? 'price'
    : 'commute';
  const searchSessionKey = `jachwi.neighborhood-search.v1.${JSON.stringify([mode, isPublicExplore, config.apiBaseUrl, config.boundaryBaseUrl, isMockData])}`;
  const [restoredSearch] = useState(() => readNeighborhoodSearch(searchSessionKey));
  const routeAreaId = location.pathname.match(/\/(?:areas|prices)\/([^/]+)/)?.[1] ?? null;
  const [addressResults, setAddressResults] = useState<MapAddress[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const mapPath = isPublicExplore ? `/explore/${mode}` : '/neighborhoods/map';
  const [phase, setPhase] = useState<'map' | 'conditions' | 'analyzing'>(restoredSearch ? 'analyzing' : 'map');
  const [destination, setDestination] = useState(restoredSearch?.destination ?? PREVIEW_DESTINATION);
  const [mapCandidate, setMapCandidate] = useState(restoredSearch?.destination ?? PREVIEW_DESTINATION);
  const [selectionCenter, setSelectionCenter] = useState(restoredSearch?.destination ?? PREVIEW_DESTINATION);
  const [selectionLevel, setSelectionLevel] = useState(6);
  const resultView = useRef<{ latitude: number; longitude: number; level: number } | null>(null);
  const [hasChosenMapPoint, setHasChosenMapPoint] = useState(false);
  const [shouldFocusMapSearch, setShouldFocusMapSearch] = useState(false);
  const locationIntent = useRef(0);
  const [currentPosition, setCurrentPosition] = useState<MapCoordinate | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [maxMinutes, setMaxMinutes] = useState(restoredSearch?.maxMinutes ?? 40);
  const [maxTransfers, setMaxTransfers] = useState(restoredSearch?.maxTransfers ?? 1);
  const [maxRent, setMaxRent] = useState(restoredSearch?.maxRent ?? 0);
  const isValidCommuteTime =
    Number.isInteger(maxMinutes) && maxMinutes >= 10 && maxMinutes <= 60 && maxMinutes % 10 === 0;
  const [selectedId, setSelectedId] = useState<string | null>(routeAreaId ?? restoredSearch?.selectedId ?? null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(restoredSearch?.selectedStopId ?? null);
  useEffect(() => {
    writeNeighborhoodSearch(
      searchSessionKey,
      phase === 'analyzing' ? { destination, maxMinutes, maxTransfers, maxRent, selectedId, selectedStopId } : null,
    );
  }, [searchSessionKey, phase, destination, maxMinutes, maxTransfers, maxRent, selectedId, selectedStopId]);
  useEffect(() => {
    if (routeAreaId) setSelectedId(routeAreaId);
  }, [routeAreaId]);
  useEffect(() => {
    let cancelled = false;
    const intent = locationIntent.current;
    void (async () => {
      try {
        if ((await readGeolocationPermission()) !== 'granted') {
          return;
        }
        const coordinate = await requestCurrentMapLocation();
        if (cancelled || intent !== locationIntent.current) return;
        const current = { ...coordinate, name: '현재 위치', address: '현재 위치 기준' };
        setCurrentPosition(coordinate);
        setMapCandidate(current);
        setSelectionCenter(current);
      } catch {
        // 위치를 못 받으면 기본 지도에서 직접 찍도록 유지한다.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const commute = useCommuteAreas({
    destination,
    maxMinutes,
    maxTransfers,
    enabled: phase === 'analyzing' && mode === 'commute',
  });
  const price = useQuery({
    queryKey: ['rental-areas', config.apiBaseUrl, config.boundaryBaseUrl, destination.latitude, destination.longitude],
    queryFn: async ({ signal }) => {
      const boundaries = await client.fetchQuery({
        queryKey: ['legal-boundaries', config.boundaryBaseUrl],
        queryFn: ({ signal }) => fetchLegalBoundaries(config.boundaryBaseUrl, signal),
        staleTime: 30 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
      });
      const results = await Promise.all(
        nearbyLegalBoundaries(boundaries, destination).map(async (boundary) => ({
          ...boundary,
          ...(await client.fetchQuery({
            queryKey: ['rental-average', config.apiBaseUrl, boundary.legalDongCode],
            queryFn: () => fetchRentalAverage(config, boundary.legalDongCode, signal),
            staleTime: 5 * 60 * 1000,
          })),
        })),
      );
      return results.sort((a, b) => (a.average ?? Infinity) - (b.average ?? Infinity));
    },
    enabled: phase === 'analyzing' && mode === 'price',
    refetchOnMount: false,
    retry: false,
  });
  const allPriceAreas = mode === 'price' ? (price.data ?? []) : [];
  const priceAreas = useMemo(
    () =>
      (mode === 'price' ? (price.data ?? []) : []).filter(
        (area) => maxRent === 0 || (area.average !== null && area.average <= maxRent * 10000),
      ),
    [price.data, mode, maxRent],
  );
  const selectedPrice = allPriceAreas.find((area) => area.legalDongCode === (routeAreaId ?? selectedId));
  const areas = mode === 'commute' ? commute.data?.areas : undefined;
  const analytics = useNeighborhoodAnalytics({
    mode,
    mock: isMockData,
    analyzing: phase === 'analyzing',
    fetching: mode === 'price' ? price.isFetching : commute.isFetching,
    success: mode === 'price' ? price.isSuccess : commute.isSuccess,
    error: mode === 'price' ? price.isError : commute.isError,
    resultCount: mode === 'price' ? priceAreas.length : (areas?.length ?? 0),
    transactionCount: priceAreas.reduce((count, area) => count + area.items.length, 0),
  });
  useEffect(() => {
    const result = mode === 'price' ? price : commute;
    if (isPublicExplore && phase === 'analyzing' && result.isSuccess && !result.isFetching) {
      completeExploration(mode === 'price' ? priceAreas.length : (areas?.length ?? 0));
    }
  }, [
    isPublicExplore,
    phase,
    mode,
    price.isSuccess,
    price.isFetching,
    commute.isSuccess,
    commute.isFetching,
    priceAreas.length,
    areas?.length,
  ]);
  const selected = areas?.find((area) => area.adminDongCode === (routeAreaId ?? selectedId));
  const selectedStation = selected?.stations.find((station) => station.stopId === selectedStopId);
  useEffect(() => {
    if (selected && !selectedStation) setSelectedStopId(selected.stations[0]?.stopId ?? null);
  }, [selected, selectedStation]);
  const route = useQuery({
    queryKey: [
      'commute-route',
      config.apiBaseUrl,
      destination.latitude,
      destination.longitude,
      selectedStopId,
      maxMinutes,
      maxTransfers,
    ],
    queryFn: ({ signal }) => {
      if (!selectedStopId) throw new Error('출발 정류장을 선택해 주세요.');
      return fetchCommuteRoute(config, destination, selectedStopId, maxMinutes, maxTransfers, signal);
    },
    enabled: !!selectedStation && phase === 'analyzing' && mode === 'commute',
    retry: false,
  });
  const regions = useMemo(
    () =>
      mode === 'price'
        ? priceAreas.map((area) => ({
            id: area.legalDongCode,
            name: area.name,
            center: area.center,
            paths: area.polygons.map((polygon) => polygon[0]),
            polygons: area.polygons,
            appearance:
              area.legalDongCode === selectedId
                ? { fillColor: '#168BFF', strokeColor: '#0875E1' }
                : { fillColor: '#94A3B8', strokeColor: '#8492A6' },
            summary: { price: area.average === null ? '거래 정보 없음' : `${Math.round(area.average / 10000)}만원` },
          }))
        : (areas ?? []).map((area) => ({
            ...commuteAreaToRegion(area),
            summary: undefined,
            appearance: commuteColor(area.commuteMinutes),
            drawStage: commuteBand(area.commuteMinutes),
          })),
    [areas, maxMinutes, mode, priceAreas, selectedId],
  );
  return {
    isPublicExplore,
    mapPath,
    priceAreas,
    maxRent,
    changeMaxRent: setMaxRent,
    selectedPrice,
    closePrice: () => setSelectedId(null),
    currentPosition,
    isLocating,
    locationError,
    moveToCurrentLocation: async () => {
      if (isLocating) return;
      const intent = ++locationIntent.current;
      const request = requestCurrentMapLocation();
      setIsLocating(true);
      setLocationError(null);
      try {
        const coordinate = await request;
        if (intent !== locationIntent.current) return;
        setCurrentPosition(coordinate);
        if (phase === 'analyzing') {
          resultView.current = { ...coordinate, level: 6 };
        } else {
          const current = { ...coordinate, name: '현재 위치', address: '현재 위치 기준' };
          setSelectionCenter(current);
          setSelectionLevel(4);
          setDestination(current);
          setMapCandidate(current);
          setHasChosenMapPoint(true);
          setShouldFocusMapSearch(false);
          setPhase('conditions');
        }
      } catch (error) {
        if (intent !== locationIntent.current) return;
        setLocationError(
          error instanceof MapLocationError && error.reason === 'denied'
            ? '위치 권한을 허용해 주세요.'
            : error instanceof MapLocationError && error.reason === 'insecure'
              ? 'HTTPS 주소에서 현재 위치를 확인할 수 있어요.'
              : '현재 위치를 찾지 못했어요. 다시 시도해주세요.',
        );
      } finally {
        setIsLocating(false);
      }
    },
    missingBoundaryCount: areas?.filter((area) => area.polygons.length === 0).length ?? 0,
    topAreas: areas?.slice(0, 5) ?? [],
    selectedStation,
    route: selectedStation ? route.data : undefined,
    isRouteLoading: !!selectedStation && (route.isPending || route.isFetching),
    routeError: selectedStation && route.isError && !route.isFetching ? describeRouteError(route.error) : null,
    retryRoute: () => route.refetch(),
    isMockData,
    mode,
    showCommute: mode === 'commute',
    showPrice: mode === 'price',
    openModeSelection: () => {
      void client.cancelQueries({ queryKey: ['commute-areas'] });
      navigate(isPublicExplore ? '/explore' : '/neighborhoods');
    },
    isChoosingConditions: phase === 'conditions',
    editLocation: () => {
      locationIntent.current += 1;
      setHasChosenMapPoint(false);
      setShouldFocusMapSearch(true);
      setPhase('map');
    },
    startAnalysis: () => {
      if (phase !== 'conditions' || (mode === 'commute' && !isValidCommuteTime)) return;
      analytics.startSearch({ maxMinutes, maxTransfers, maxRent });
      resultView.current = null;
      setSelectedId(null);
      setSelectedStopId(null);
      if (isPublicExplore) startExploration(mode, isMockData);
      setPhase('analyzing');
    },
    selectionCenter,
    selectionLevel,
    rememberResultCenter: (latitude: number, longitude: number) => {
      resultView.current = { latitude, longitude, level: resultView.current?.level ?? 10 };
    },
    rememberResultLevel: (level: number) => {
      if (resultView.current) resultView.current.level = level;
    },
    query,
    addressResults,
    isSearching,
    searchError,
    selectAddress: (address: MapAddress) => {
      locationIntent.current += 1;
      setCurrentPosition(null);
      const point = {
        ...address,
        name: address.roadAddress ?? address.jibunAddress ?? address.address ?? '선택한 위치',
        address: address.address ?? '',
      };
      setAddressResults([]);
      setMapCandidate(point);
      setDestination(point);
      setSelectionCenter(point);
      setSelectionLevel(4);
      setHasChosenMapPoint(true);
      setShouldFocusMapSearch(false);
      setPhase('conditions');
    },
    changeQuery: (value: string) => {
      locationIntent.current += 1;
      setQuery(value);
      setAddressResults([]);
      setSearchError(null);
      setIsSearching(false);
      setHasChosenMapPoint(false);
      setPhase('map');
    },
    searchDestination: async () => {
      if (!query.trim()) return;
      const intent = ++locationIntent.current;
      setIsSearching(true);
      setSearchError(null);
      try {
        const results = await searchAddress(config, query.trim());
        if (intent !== locationIntent.current) return;
        setAddressResults(results);
        if (!results.length) setSearchError('검색 결과가 없어요. 주소를 더 자세히 입력해주세요.');
      } catch {
        if (intent === locationIntent.current)
          setSearchError('주소를 찾지 못했어요. 지도에서 위치를 선택하거나 다시 검색해주세요.');
      } finally {
        if (intent === locationIntent.current) setIsSearching(false);
      }
    },
    shouldFocusMapSearch,
    openMapSearch: () => {
      setShouldFocusMapSearch(true);
      setMapCandidate(destination);
      setSelectionCenter(destination);
      setHasChosenMapPoint(false);
      setPhase('map');
    },
    destination,
    mapCandidate,
    hasChosenMapPoint,
    isSelectingOnMap: phase === 'map' || phase === 'conditions',
    openMapSelection: () => {
      setShouldFocusMapSearch(false);
      setMapCandidate(destination);
      setSelectionCenter(destination);
      setHasChosenMapPoint(false);
      setPhase('map');
    },
    chooseMapPoint: (latitude: number, longitude: number) => {
      if (phase === 'analyzing') return;
      locationIntent.current += 1;
      setCurrentPosition(null);
      void client.cancelQueries({ queryKey: ['commute-areas'] });
      setSelectedId(null);
      setSelectedStopId(null);
      setShouldFocusMapSearch(false);
      const point = {
        name: '선택한 위치',
        address: '',
        latitude,
        longitude,
      };
      setMapCandidate(point);
      setDestination(point);
      setSelectionCenter(point);
      setSelectionLevel(4);
      setHasChosenMapPoint(true);
      setPhase('conditions');
      const intent = locationIntent.current;
      void reverseGeocode(config, latitude, longitude)
        .then((address) => {
          if (intent !== locationIntent.current || !address.address) return;
          const locationName =
            isMockData && address.address.startsWith('MSW 테스트 위치') ? '선택한 위치' : address.address;
          const namedPoint = { ...point, name: locationName, address: locationName };
          setMapCandidate(namedPoint);
          setDestination(namedPoint);
        })
        .catch(() => {
          /* 주소 조회 실패 시 좌표 대신 일반 위치 이름을 유지한다. */
        });
    },
    confirmMapPoint: () => {
      if (!hasChosenMapPoint || phase !== 'map') return;
      setDestination(mapCandidate);
      setSelectedId(null);
      setSelectedStopId(null);
      setPhase('conditions');
    },
    hasPickedDestination: true,
    isAnalyzing:
      phase === 'analyzing' &&
      (mode === 'price' ? price.isPending || price.isFetching : commute.isPending || commute.isFetching),
    error:
      phase === 'analyzing' && (mode === 'price' ? price.isError : commute.isError)
        ? describeError(mode === 'price' ? price.error : commute.error)
        : null,
    retry: () => {
      analytics.startSearch({ maxMinutes, maxTransfers, maxRent }, 'retry');
      return mode === 'price' ? price.refetch() : commute.refetch();
    },
    maxMinutes,
    isValidCommuteTime,
    changeMaxMinutes: setMaxMinutes,
    maxTransfers,
    changeMaxTransfers: setMaxTransfers,
    resultLevel: resultView.current?.level ?? (mode === 'price' ? 8 : 10),
    center:
      resultView.current ??
      resultMapCenter(
        areas?.length
          ? {
              latitude:
                (Math.min(...areas.map((area) => area.center.latitude)) +
                  Math.max(...areas.map((area) => area.center.latitude))) /
                2,
              longitude:
                (Math.min(...areas.map((area) => area.center.longitude)) +
                  Math.max(...areas.map((area) => area.center.longitude))) /
                2,
            }
          : (priceAreas[0]?.center ?? destination),
        mode === 'price' ? 8 : 10,
      ),
    reset: () => {
      analytics.cancelSearch();
      if (location.pathname.includes('/areas/') || location.pathname.includes('/prices/'))
        navigate(`${mapPath}?mode=${mode}`, { replace: true });
      void client.cancelQueries({ queryKey: ['commute-areas'] });
      locationIntent.current += 1;
      if (resultView.current) {
        const view = resultView.current;
        setSelectionCenter((previous) => ({ ...previous, latitude: view.latitude, longitude: view.longitude }));
        setSelectionLevel(view.level);
      }
      setHasChosenMapPoint(false);
      setShouldFocusMapSearch(true);
      setPhase('map');
      setSelectedId(null);
      setSelectedStopId(null);
    },
    regions,
    selected,
    selectRegion: (id: string | null) => {
      const area =
        mode === 'commute'
          ? areas?.find((area) => area.adminDongCode === id)
          : priceAreas.find((area) => area.legalDongCode === id);
      if (area) analytics.selectArea();
      if (area) resultView.current = { ...resultMapCenter(area.center, 7), level: 7 };
      setSelectedId(id);
      setSelectedStopId(areas?.find((area) => area.adminDongCode === id)?.stations[0]?.stopId ?? null);
      if (id && mode === 'commute') navigate(`${mapPath}/areas/${id}?mode=${mode}`);
      if (id && mode === 'price') navigate(`${mapPath}/prices/${id}?mode=price`);
    },
    selectStation: (id: string) => {
      if (!selected?.stations.some((station) => station.stopId === id) || id === selectedStopId) return;
      analytics.changeStation();
      setSelectedStopId(id);
    },
    openAreaDetails: () => {
      if (selected) navigate(`${mapPath}/areas/${selected.adminDongCode}/details?mode=commute`);
    },
  };
};
export default useNeighborhoodPreview;
export type NeighborhoodPreviewContext = ReturnType<typeof useNeighborhoodPreview>;
