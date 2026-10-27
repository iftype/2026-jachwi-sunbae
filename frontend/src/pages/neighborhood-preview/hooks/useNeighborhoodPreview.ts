import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { ApiError } from '@/features/auth/api/apiClient';
import { commuteAreaToRegion } from '@/features/map/api/commuteApi';
import { fetchCommuteRoute } from '@/features/map/api/commuteRouteApi';
import { reverseGeocode, searchAddress } from '@/features/map/api/mapApi';
import { useCommuteAreas } from '@/features/map/api/useCommuteAreas';
import { readGeolocationPermission, requestCurrentMapLocation } from '@/features/map/lib/mapLocation';
import { type MapCoordinate, MapLocationError } from '@/features/map/lib/mapLocation';
import type { MapAddress } from '@/features/map/model/Map';
import { completeExploration, startExploration } from '@/features/onboarding/lib/explorationJourney';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';
import useReturnNavigation from '@/shared/lib/navigation/useReturnNavigation';

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
export const describeRouteError = (error: unknown) => {
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
  const client = useQueryClient();
  const isMockData = config.commuteDataSource === 'mock';
  const [query, setQuery] = useState('');
  const isPublicExplore = location.pathname === '/explore' || location.pathname.startsWith('/explore/');
  const searchSessionKey = `jachwi.neighborhood-search.v2.${JSON.stringify([isPublicExplore, config.apiBaseUrl, config.boundaryBaseUrl, isMockData])}`;
  const [restoredSearch] = useState(() => readNeighborhoodSearch(searchSessionKey));
  const routeAreaId = location.pathname.match(/\/areas\/([^/]+)/)?.[1] ?? null;
  const [addressResults, setAddressResults] = useState<MapAddress[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const mapPath = isPublicExplore ? '/explore' : '/neighborhoods';
  // 첫 화면이 곧 지도라 돌아갈 탐색 기준 선택 화면이 없다. 들어온 화면으로 돌아가고, 직접 들어왔으면 홈으로 간다.
  const leave = useReturnNavigation({ cameFromTarget: true, fallback: '/' });
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
    enabled: phase === 'analyzing',
  });
  const allAreas = commute.data?.areas;
  // 월세 조건은 받은 동네 시세의 상한이다. 시세가 없는 동네는 전체 가격일 때만 보여준다.
  const areas = useMemo(
    () =>
      allAreas?.filter((area) => maxRent === 0 || (area.rent !== null && area.rent.monthlyRentKrw <= maxRent * 10000)),
    [allAreas, maxRent],
  );
  const analytics = useNeighborhoodAnalytics({
    mock: isMockData,
    analyzing: phase === 'analyzing',
    fetching: commute.isFetching,
    success: commute.isSuccess,
    error: commute.isError,
    resultCount: areas?.length ?? 0,
    rentCount: areas?.filter((area) => area.rent !== null).length ?? 0,
  });
  useEffect(() => {
    if (isPublicExplore && phase === 'analyzing' && commute.isSuccess && !commute.isFetching) {
      completeExploration(areas?.length ?? 0);
    }
  }, [isPublicExplore, phase, commute.isSuccess, commute.isFetching, areas?.length]);
  const selected = allAreas?.find((area) => area.adminDongCode === (routeAreaId ?? selectedId));
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
    enabled: !!selectedStation && phase === 'analyzing',
    retry: false,
  });
  const regions = useMemo(
    () =>
      (areas ?? []).map((area) => ({
        ...commuteAreaToRegion(area),
        summary: undefined,
        appearance: commuteColor(area.commuteMinutes),
        drawStage: commuteBand(area.commuteMinutes),
      })),
    [areas],
  );
  return {
    isPublicExplore,
    mapPath,
    maxRent,
    changeMaxRent: setMaxRent,
    rentPeriod: commute.data?.rentPeriod ?? null,
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
    leave: () => {
      void client.cancelQueries({ queryKey: ['commute-areas'] });
      leave();
    },
    isChoosingConditions: phase === 'conditions',
    editLocation: () => {
      locationIntent.current += 1;
      setHasChosenMapPoint(false);
      setShouldFocusMapSearch(true);
      setPhase('map');
    },
    startAnalysis: () => {
      if (phase !== 'conditions' || !isValidCommuteTime) return;
      analytics.startSearch({ maxMinutes, maxTransfers, maxRent });
      resultView.current = null;
      setSelectedId(null);
      setSelectedStopId(null);
      if (isPublicExplore) startExploration('commute', isMockData);
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
      // 지도를 직접 누르면 시점을 옮기지 않는다. 가운데로 옮기거나 확대하면 핀이 누른 자리에서 벗어나 다른 곳에 찍힌 것처럼 보인다.
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
    isAnalyzing: phase === 'analyzing' && (commute.isPending || commute.isFetching),
    error: phase === 'analyzing' && commute.isError ? describeError(commute.error) : null,
    retry: () => {
      analytics.startSearch({ maxMinutes, maxTransfers, maxRent }, 'retry');
      return commute.refetch();
    },
    maxMinutes,
    isValidCommuteTime,
    changeMaxMinutes: setMaxMinutes,
    maxTransfers,
    changeMaxTransfers: setMaxTransfers,
    // 새로고침·뒤로가기로 고른 동네가 복원되면 전체 보기 대신 그 동네로 연다. 고른 동네 화면의 정류장·부동산을 바로 보여주기 위해서다.
    resultLevel: resultView.current?.level ?? (selected ? 7 : 10),
    center:
      resultView.current ??
      (selected ? resultMapCenter(selected.center, 7) : undefined) ??
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
          : destination,
        10,
      ),
    reset: () => {
      analytics.cancelSearch();
      if (location.pathname.includes('/areas/')) navigate(mapPath, { replace: true });
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
    selectRegion: (id: string | null, options?: { openDetails?: boolean }) => {
      const area = areas?.find((area) => area.adminDongCode === id);
      if (area) analytics.selectArea();
      if (area) resultView.current = { ...resultMapCenter(area.center, 7), level: 7 };
      setSelectedId(id);
      setSelectedStopId(area?.stations[0]?.stopId ?? null);
      // 데스크탑은 상세를 목록 옆에 붙여 지도를 가리지 않으므로, 동네를 고르면 바로 상세를 연다.
      const openDetails = options?.openDetails ?? location.pathname.endsWith('/details');
      if (id) navigate(`${mapPath}/areas/${id}${openDetails ? '/details' : ''}`);
    },
    selectStation: (id: string) => {
      if (!selected?.stations.some((station) => station.stopId === id) || id === selectedStopId) return;
      analytics.changeStation();
      setSelectedStopId(id);
    },
    openAreaDetails: () => {
      if (selected) navigate(`${mapPath}/areas/${selected.adminDongCode}/details`);
    },
    closeAreaDetails: () => {
      if (selected) navigate(`${mapPath}/areas/${selected.adminDongCode}`, { replace: true });
    },
    openListing: analytics.openListing,
  };
};
export default useNeighborhoodPreview;
export type NeighborhoodPreviewContext = ReturnType<typeof useNeighborhoodPreview>;
