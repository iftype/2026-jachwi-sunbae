import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { markFinderUsed } from '@/pages/design-records/model/finderUsed';
import { ApiError } from '@/features/auth/api/apiClient';
import { commuteAreaToRegion, rentLabelOf } from '@/features/map/api/commuteApi';
import { fetchCommuteRoute } from '@/features/map/api/commuteRouteApi';
import { reverseGeocode, searchPlacesAndAddresses } from '@/features/map/api/mapApi';
import { useCommuteAreas } from '@/features/map/api/useCommuteAreas';
import { usePrefetchMetroBoundaries } from '@/features/map/api/usePrefetchMetroBoundaries';
import { writeCommuteDestination } from '@/features/map/lib/commuteDestinationStore';
import { requestCurrentMapLocation } from '@/features/map/lib/mapLocation';
import { MapLocationError } from '@/features/map/lib/mapLocation';
import { distanceMeters } from '@/features/map/lib/mapViewportQuery';
import type { MapAddress } from '@/features/map/model/Map';
import { MAX_MAP_LEVEL, MIN_MAP_LEVEL } from '@/features/map/ui/map-zoom-control/MapZoomControl';
import { completeExploration, startExploration } from '@/features/onboarding/lib/explorationJourney';
import { INTRO_MAP_LEVEL, SAMPLE_PROPERTIES_VIEW } from '@/features/property/model/sampleProperties';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';
import {
  EXPLORE_PATH,
  HOME_PATH,
  neighborhoodAreaDetailsPath,
  neighborhoodAreaPath,
  type NeighborhoodBasePath,
  NEIGHBORHOODS_PATH,
} from '@/shared/lib/navigation/appPaths';

import {
  commuteBand,
  commuteColor,
  NO_RENT_COLOR,
  OUT_OF_RENT_COLOR,
  OUT_OF_RENT_DRAW_STAGE,
} from '../model/commuteColors';
import {
  neighborhoodSearchKey,
  readNeighborhoodSearch,
  writeNeighborhoodSearch,
} from '../model/neighborhoodSearchSession';
import { PREVIEW_DESTINATION } from '../model/preview';
import { type MapViewport, routeFocusView } from '../model/resultMapView';
import useNeighborhoodAnalytics from './useNeighborhoodAnalytics';

const describeError = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.code === 'COMMUTE_DESTINATION_UNREACHABLE')
      return '목적지에서 걸어서 10분 안에 탈 수 있는 정류장이나 역이 없어요. 다른 목적지를 골라 주세요.';
    if (error.code === 'TRANSIT_NETWORK_UNAVAILABLE')
      return '대중교통 정보를 준비하고 있어요. 잠시 후 다시 시도해 주세요.';
    if (error.code === 'ADMIN_DONG_NOT_FOUND')
      return '이 위치의 동네를 찾지 못했어요. 지도에서 다른 위치를 골라 주세요.';
  }
  return '정보를 불러오지 못했어요. 다시 시도해 주세요.';
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
  const isPublicExplore = location.pathname === EXPLORE_PATH || location.pathname.startsWith(`${EXPLORE_PATH}/`);
  const searchSessionKey = neighborhoodSearchKey(config, isPublicExplore);
  const [restoredSearch] = useState(() => readNeighborhoodSearch(searchSessionKey));
  const routeAreaId = location.pathname.match(/\/areas\/([^/]+)/)?.[1] ?? null;
  const [addressResults, setAddressResults] = useState<MapAddress[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const mapPath: NeighborhoodBasePath = isPublicExplore ? EXPLORE_PATH : NEIGHBORHOODS_PATH;
  // 동네 선택도 방문 이력에 쌓이므로, 홈 아이콘은 이전 동네가 아닌 홈으로 바로 이동한다.
  const leave = () => void navigate(HOME_PATH);
  const [phase, setPhase] = useState<'map' | 'conditions' | 'analyzing'>(restoredSearch ? 'analyzing' : 'map');
  const [destination, setDestination] = useState(restoredSearch?.destination ?? PREVIEW_DESTINATION);
  const [mapCandidate, setMapCandidate] = useState(restoredSearch?.destination ?? PREVIEW_DESTINATION);
  // 출퇴근 장소를 고른 적이 없으면 기록 지도의 첫 화면과 같은 미리보기 매물 자리에서 시작한다.
  const [selectionCenter, setSelectionCenter] = useState(
    restoredSearch?.destination ?? {
      ...PREVIEW_DESTINATION,
      latitude: SAMPLE_PROPERTIES_VIEW.latitude,
      longitude: SAMPLE_PROPERTIES_VIEW.longitude,
    },
  );
  const [selectionLevel, setSelectionLevel] = useState(INTRO_MAP_LEVEL);
  // 장소를 고르는 지도에서 손가락이나 휠로 옮긴 시점. 다시 그리지 않고 기억만 했다가 확대·축소 버튼을 누르면 이 자리에서 옮긴다.
  const selectionView = useRef<{ latitude: number; longitude: number; level: number } | null>(null);
  const pendingSearchCamera = useRef(false);
  const resultView = useRef<{ latitude: number; longitude: number; level: number } | null>(null);
  // 화면(휴대폰, 데스크탑)이 알려 주는 결과 지도 칸 크기와 가리는 여백. 동네나 출발 정류장을 고를 때 시점을 그 칸에 맞춘다.
  const mapViewportReader = useRef<(() => MapViewport | null) | null>(null);
  const readMapViewport = () => mapViewportReader.current?.() ?? undefined;
  // 결과 지도 시점은 ref에 두므로, 목록에서 정류장을 고를 때처럼 시점만 바꾸면 다시 그리도록 이 값을 올린다.
  const [, setResultViewVersion] = useState(0);
  const [hasChosenMapPoint, setHasChosenMapPoint] = useState(Boolean(restoredSearch));
  const [isMapSelectionEnabled, setIsMapSelectionEnabled] = useState(false);
  // 지도 검색(위쪽 검색창)으로 간 자리의 검색 핀. 출퇴근 장소(`mapCandidate`, `destination`)와는 따로 두며, 통근 분석에 쓰지 않는다.
  const [searchPin, setSearchPin] = useState<{ latitude: number; longitude: number; name: string } | null>(null);
  const [shouldFocusMapSearch, setShouldFocusMapSearch] = useState(false);
  const locationIntent = useRef(0);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [maxMinutes, setMaxMinutes] = useState(restoredSearch?.maxMinutes ?? 40);
  const [maxRent, setMaxRent] = useState(restoredSearch?.maxRent ?? 0);
  const [maxTransfers, setMaxTransfers] = useState(restoredSearch?.maxTransfers ?? 1);
  const [submitted, setSubmitted] = useState(
    restoredSearch
      ? {
          destination: restoredSearch.destination,
          maxMinutes: restoredSearch.maxMinutes,
          maxTransfers: restoredSearch.maxTransfers,
          maxRent: restoredSearch.maxRent,
        }
      : null,
  );
  const appliedMaxRent = submitted?.maxRent ?? maxRent;
  const hasSearchChanges =
    submitted === null ||
    submitted.maxMinutes !== maxMinutes ||
    submitted.maxTransfers !== maxTransfers ||
    submitted.maxRent !== maxRent ||
    submitted.destination.latitude !== mapCandidate.latitude ||
    submitted.destination.longitude !== mapCandidate.longitude;
  const isValidCommuteTime =
    Number.isInteger(maxMinutes) && maxMinutes >= 10 && maxMinutes <= 60 && maxMinutes % 10 === 0;
  const [selectedId, setSelectedId] = useState<string | null>(routeAreaId ?? restoredSearch?.selectedId ?? null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(restoredSearch?.selectedStopId ?? null);
  useEffect(() => {
    writeNeighborhoodSearch(searchSessionKey, submitted ? { ...submitted, selectedId, selectedStopId } : null);
  }, [searchSessionKey, submitted, selectedId, selectedStopId]);
  useEffect(() => {
    if (routeAreaId) setSelectedId(routeAreaId);
  }, [routeAreaId]);
  // 진입부터 첫 검색까지 중앙값 22초 동안 수도권 경계를 받아 두어, 검색 뒤에는 통근 API만 기다리게 한다.
  // 지도가 처음 그려지면(onReady) 시작하고, 느린 연결에서 지도보다 장소를 먼저 고르면 그때 시작한다.
  const prefetchBoundaries = usePrefetchMetroBoundaries({ isSearching: phase === 'analyzing' });
  const commute = useCommuteAreas({
    destination: submitted?.destination ?? destination,
    maxMinutes: submitted?.maxMinutes ?? maxMinutes,
    maxTransfers: submitted?.maxTransfers ?? maxTransfers,
    enabled: submitted !== null,
  });
  // 서버가 통근 시간·환승 조건으로 고른 동네 가운데 월세 시세가 있는 동네만 온다(`useCommuteAreas`가 거른다).
  // 서버는 월세로 거르지 않으므로 월세 조건은 받은 시세(월세 중앙값)의 상한으로 화면에서 거른다. 바꿔도 다시 조회하지 않는다.
  const allAreas = commute.data?.areas;
  const areas = useMemo(
    () =>
      allAreas?.filter(
        (area) => appliedMaxRent === 0 || (area.rent !== null && area.rent.monthlyRentKrw <= appliedMaxRent * 10000),
      ),
    [allAreas, appliedMaxRent],
  );
  const sortedAreas = useMemo(
    () =>
      [...(areas ?? [])].sort(
        (left, right) =>
          left.commuteMinutes - right.commuteMinutes ||
          distanceMeters(destination, left.center) - distanceMeters(destination, right.center),
      ),
    [areas, destination],
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
  // 결과 지도가 한 번이라도 나왔으면 내 기록 지도의 동네 찾기 배너를 더는 보이지 않는다.
  useEffect(() => {
    if (phase === 'analyzing' && commute.isSuccess && !commute.isFetching) markFinderUsed();
  }, [phase, commute.isSuccess, commute.isFetching]);
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
      submitted?.maxMinutes,
      submitted?.maxTransfers,
    ],
    queryFn: ({ signal }) => {
      if (!selectedStopId) throw new Error('출발 정류장을 선택해 주세요.');
      return fetchCommuteRoute(
        config,
        destination,
        selectedStopId,
        submitted?.maxMinutes ?? maxMinutes,
        submitted?.maxTransfers ?? maxTransfers,
        signal,
      );
    },
    enabled: !!selectedStation && phase === 'analyzing',
    retry: false,
  });
  // 월세 조건 밖 동네도 지도에서 빼지 않고 회색으로 깔아, 가깝지만 비싸서 빠진 동네가 어디인지 보이게 한다. 랭킹에는 넣지 않는다.
  // 월세 시세가 없는 동네는 조건과 상관없이 점선 테두리 회색으로 그리고 라벨에 `월세 정보 없음`을 적는다.
  const regions = useMemo(() => {
    const inRent = new Set(areas?.map((area) => area.adminDongCode));
    return (allAreas ?? []).map((area) =>
      area.rent === null
        ? {
            ...commuteAreaToRegion(area),
            summary: undefined,
            rentLabel: rentLabelOf(area, false),
            appearance: NO_RENT_COLOR,
            drawStage: commuteBand(area.commuteMinutes),
          }
        : inRent.has(area.adminDongCode)
          ? {
              ...commuteAreaToRegion(area),
              summary: undefined,
              rentLabel: rentLabelOf(area, false),
              appearance: commuteColor(area.commuteMinutes),
              drawStage: commuteBand(area.commuteMinutes),
            }
          : {
              ...commuteAreaToRegion(area),
              summary: undefined,
              rentLabel: rentLabelOf(area, true),
              appearance: OUT_OF_RENT_COLOR,
              drawStage: OUT_OF_RENT_DRAW_STAGE,
            },
    );
  }, [allAreas, areas]);
  const resultLevel = resultView.current?.level ?? selectionLevel;
  const resultCenter = resultView.current ?? destination;
  useEffect(() => {
    if (!pendingSearchCamera.current || phase !== 'analyzing' || commute.isFetching || !commute.isSuccess) return;
    pendingSearchCamera.current = false;
    resultView.current = routeFocusView(
      [destination, ...sortedAreas.slice(0, 3).map((area) => area.center)],
      [],
      readMapViewport(),
      7,
    );
    setResultViewVersion((version) => version + 1);
  }, [commute.isFetching, commute.isSuccess, destination, sortedAreas, phase, submitted]);
  const analyzePoint = (point: typeof mapCandidate) => {
    analytics.startSearch({ maxMinutes, maxTransfers, maxRent });
    // 본 방 기록에서 매물마다 이 장소까지 통근 시간을 보여 주려고 기억한다.
    locationIntent.current += 1;
    setDestination(point);
    // 목적지와 조건이 지난 검색과 같으면 받아 둔 결과를 그대로 보인다. 다시 조회하는 건 둘 중 하나가 바뀌었을 때뿐이다.
    setSubmitted({ destination: point, maxMinutes, maxTransfers, maxRent });
    writeCommuteDestination(point);
    if (routeAreaId) navigate(mapPath, { replace: true });
    pendingSearchCamera.current = true;
    setSelectedId(null);
    setSelectedStopId(null);
    if (isPublicExplore) startExploration('commute', isMockData);
    setPhase('analyzing');
  };
  const selectAddressAsCommute = (address: MapAddress, options?: { analyze?: boolean }) => {
    locationIntent.current += 1;
    const point = {
      ...address,
      name: address.roadAddress ?? address.jibunAddress ?? address.address ?? '선택한 위치',
      address: address.address ?? '',
      source: 'search' as const,
    };
    setAddressResults([]);
    setMapCandidate(point);
    const currentLevel = selectionView.current?.level ?? selectionLevel;
    selectionView.current = null;
    setSelectionCenter(point);
    setSelectionLevel(currentLevel);
    setHasChosenMapPoint(true);
    setShouldFocusMapSearch(false);
    setQuery(point.name);
    setPhase('conditions');
    prefetchBoundaries();
    if (options?.analyze && isValidCommuteTime) analyzePoint(point);
  };

  const moveMapToPoint = (point: { latitude: number; longitude: number }) => {
    selectionView.current = {
      latitude: point.latitude,
      longitude: point.longitude,
      level: selectionView.current?.level ?? selectionLevel,
    };
    setSelectionCenter((previous) => ({ ...previous, latitude: point.latitude, longitude: point.longitude }));
    resultView.current = {
      latitude: point.latitude,
      longitude: point.longitude,
      level: resultView.current?.level ?? resultLevel,
    };
    setResultViewVersion((version) => version + 1);
  };

  return {
    isPublicExplore,
    mapPath,
    prefetchBoundaries,
    rentPeriod: commute.data?.rentPeriod ?? null,
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
        if (phase === 'analyzing') {
          resultView.current = { ...coordinate, level: 6 };
        } else {
          const current = { ...coordinate, name: '현재 위치', address: '현재 위치 기준' };
          // 지도를 현재 위치로 옮기기만 하고 보고 있던 확대 단계는 그대로 둔다.
          const currentLevel = selectionView.current?.level ?? selectionLevel;
          selectionView.current = null;
          setSelectionCenter(current);
          setSelectionLevel(currentLevel);
          setMapCandidate(current);
          setHasChosenMapPoint(true);
          setShouldFocusMapSearch(false);
          setPhase('conditions');
          prefetchBoundaries();
        }
      } catch (error) {
        if (intent !== locationIntent.current) return;
        setLocationError(
          error instanceof MapLocationError && error.reason === 'denied'
            ? '위치 권한을 허용해 주세요.'
            : error instanceof MapLocationError && error.reason === 'insecure'
              ? 'HTTPS 주소에서 현재 위치를 확인할 수 있어요.'
              : '현재 위치를 찾지 못했어요. 다시 시도해 주세요.',
        );
      } finally {
        setIsLocating(false);
      }
    },
    missingBoundaryCount: areas?.filter((area) => area.polygons.length === 0).length ?? 0,
    topAreas: areas?.slice(0, 5) ?? [],
    /** 이번 검색으로 받은 동네(월세 조건까지 맞는 동네) 전체. 통근 시간 짧은 순, 같으면 출퇴근 장소에서 가까운 순이다. */
    resultAreas: sortedAreas,
    /** 월세 조건까지 맞는 동네 수. 지도의 회색(월세 조건 밖) 동네는 세지 않는다. */
    matchedAreaCount: areas?.length ?? 0,
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
    hasSubmittedSearch: submitted !== null,
    hasSearchChanges,
    cancelEditing: () => {
      if (!submitted) return;
      locationIntent.current += 1;
      setMapCandidate(submitted.destination);
      setMaxMinutes(submitted.maxMinutes);
      setMaxTransfers(submitted.maxTransfers);
      setMaxRent(submitted.maxRent);
      setPhase('analyzing');
    },
    editSearch: () => {
      locationIntent.current += 1;
      setMapCandidate(destination);
      setHasChosenMapPoint(true);
      setPhase('conditions');
    },
    isChoosingConditions: phase === 'conditions',
    editLocation: () => {
      locationIntent.current += 1;
      setHasChosenMapPoint(false);
      setShouldFocusMapSearch(true);
      setPhase('map');
    },
    startAnalysis: () => {
      if ((phase !== 'conditions' && phase !== 'analyzing') || !hasChosenMapPoint || !isValidCommuteTime) return;
      analyzePoint(mapCandidate);
    },
    selectionCenter: selectionView.current ?? selectionCenter,
    selectionLevel: selectionView.current?.level ?? selectionLevel,
    rememberSelectionCenter: (latitude: number, longitude: number) => {
      selectionView.current = { latitude, longitude, level: selectionView.current?.level ?? selectionLevel };
    },
    rememberSelectionLevel: (level: number) => {
      selectionView.current = { ...(selectionView.current ?? selectionCenter), level };
    },
    /** 장소를 고르는 지도의 확대(-1), 축소(+1) 버튼. 지금 보이는 자리를 가운데 둔 채 한 단계 옮긴다. */
    zoomSelectionBy: (delta: -1 | 1) => {
      const current = selectionView.current ?? { ...selectionCenter, level: selectionLevel };
      const level = Math.max(MIN_MAP_LEVEL, Math.min(MAX_MAP_LEVEL, current.level + delta));
      selectionView.current = { latitude: current.latitude, longitude: current.longitude, level };
      setSelectionCenter((previous) => ({ ...previous, latitude: current.latitude, longitude: current.longitude }));
      setSelectionLevel(level);
    },
    rememberResultCenter: (latitude: number, longitude: number) => {
      resultView.current = { latitude, longitude, level: resultView.current?.level ?? resultLevel };
    },
    /** 결과 지도 확대(-1)·축소(+1) 버튼. 휠이나 손가락으로 바꾼 단계는 다시 그리지 않고 기억만 하므로 기억한 값에서 옮긴다. */
    zoomResultBy: (delta: -1 | 1) => {
      const current = resultView.current ?? { ...resultCenter, level: resultLevel };
      const level = Math.max(MIN_MAP_LEVEL, Math.min(MAX_MAP_LEVEL, current.level + delta));
      resultView.current = { latitude: current.latitude, longitude: current.longitude, level };
      setResultViewVersion((version) => version + 1);
    },
    zoomToFacilities: (level: number) => {
      if (phase === 'analyzing') {
        resultView.current = { ...(resultView.current ?? resultCenter), level };
        setResultViewVersion((version) => version + 1);
      } else {
        const center = selectionView.current ?? selectionCenter;
        selectionView.current = { ...center, level };
        setSelectionCenter((previous) => ({ ...previous, latitude: center.latitude, longitude: center.longitude }));
        setSelectionLevel(level);
      }
    },
    rememberResultLevel: (level: number) => {
      resultView.current = { ...(resultView.current ?? resultCenter), level };
    },
    query,
    addressResults,
    isSearching,
    searchError,
    selectAddress: selectAddressAsCommute,
    changeQuery: (value: string) => {
      locationIntent.current += 1;
      setQuery(value);
      setAddressResults([]);
      setSearchError(null);
      setIsSearching(false);
      setHasChosenMapPoint(false);
    },
    searchDestination: async () => {
      if (!query.trim()) return;
      const intent = ++locationIntent.current;
      setIsSearching(true);
      setSearchError(null);
      try {
        const results = await searchPlacesAndAddresses(config, query.trim());
        if (intent !== locationIntent.current) return;
        setAddressResults(results);
        if (!results.length) setSearchError('검색 결과가 없어요. 주소를 더 자세히 입력해 주세요.');
      } catch {
        if (intent === locationIntent.current)
          setSearchError('주소를 찾지 못했어요. 지도에서 위치를 선택하거나 다시 검색해 주세요.');
      } finally {
        if (intent === locationIntent.current) setIsSearching(false);
      }
    },
    shouldFocusMapSearch,
    openMapSearch: () => {
      setShouldFocusMapSearch(true);
      setMapCandidate(destination);
      selectionView.current = null;
      setSelectionCenter(destination);
      setHasChosenMapPoint(false);
      setPhase('map');
    },
    destination,
    mapCandidate,
    hasChosenMapPoint,
    isSelectingOnMap: phase === 'map' || phase === 'conditions',
    isMapSelectionEnabled,
    cancelMapSelection: () => setIsMapSelectionEnabled(false),
    openMapSelection: () => {
      setIsMapSelectionEnabled(true);
      setShouldFocusMapSearch(false);
      // 지난 검색이 있으면 그 출퇴근 장소에서 다시 고른다. 처음이면 보고 있던 지도를 그대로 두고 고른다(기본 목적지로 옮기지 않는다).
      if (submitted) {
        setMapCandidate(destination);
        selectionView.current = null;
        setSelectionCenter(destination);
      }
      setHasChosenMapPoint(false);
      setPhase('map');
    },
    chooseMapPoint: (latitude: number, longitude: number) => {
      if (phase === 'analyzing' || !isMapSelectionEnabled) return;
      setIsMapSelectionEnabled(false);
      locationIntent.current += 1;
      setShouldFocusMapSearch(false);
      const point = {
        name: '선택한 위치',
        address: '',
        latitude,
        longitude,
        source: 'map' as const,
      };
      setMapCandidate(point);
      // 지도를 직접 누르면 시점을 옮기지 않는다. 가운데로 옮기거나 확대하면 핀이 누른 자리에서 벗어나 다른 곳에 찍힌 것처럼 보인다.
      setHasChosenMapPoint(true);
      setPhase('conditions');
      prefetchBoundaries();
      const intent = locationIntent.current;
      void reverseGeocode(config, latitude, longitude)
        .then((address) => {
          if (intent !== locationIntent.current || !address.address) return;
          const locationName =
            isMockData && address.address.startsWith('MSW 테스트 위치') ? '선택한 위치' : address.address;
          const namedPoint = { ...point, name: locationName, address: locationName };
          setMapCandidate(namedPoint);
        })
        .catch(() => {
          /* 주소 조회 실패 시 좌표 대신 일반 위치 이름을 유지한다. */
        });
    },
    confirmMapPoint: () => {
      if (!hasChosenMapPoint || phase !== 'map') return;
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
    maxRent,
    // 월세는 받아 둔 결과에서 화면이 거르므로, 검색한 뒤에 바꾸면 다시 검색하지 않고 바로 적용한다.
    changeMaxRent: (value: number) => {
      setMaxRent(value);
      setSubmitted((current) => (current === null ? current : { ...current, maxRent: value }));
    },
    isValidCommuteTime,
    changeMaxMinutes: setMaxMinutes,
    maxTransfers,
    changeMaxTransfers: setMaxTransfers,
    resultLevel,
    center: resultCenter,
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
    selectRegion: (id: string | null, options?: { openDetails?: boolean; focus?: 'route' | 'area' | 'none' }) => {
      // 회색(월세 조건 밖) 동네도 지도에서 고를 수 있어 받은 동네 전체에서 찾는다.
      const area = allAreas?.find((area) => area.adminDongCode === id);
      if (area) analytics.selectArea();
      // 동네를 골라도 지도의 확대 단계와 위치는 바꾸지 않는다. 카드만 띄운다(`focus` 옵션은 호출부 호환용으로만 남긴다).
      setSelectedId(id);
      setSelectedStopId(area?.stations[0]?.stopId ?? null);
      // 데스크탑은 상세를 목록 옆에 붙여 지도를 가리지 않으므로, 동네를 고르면 바로 상세를 연다.
      const openDetails = options?.openDetails ?? location.pathname.endsWith('/details');
      if (id) navigate(openDetails ? neighborhoodAreaDetailsPath(mapPath, id) : neighborhoodAreaPath(mapPath, id));
      // 선택을 풀면 동네 주소에서 지도 주소로 돌아가야 주소의 동네가 다시 골라지지 않는다.
      else if (routeAreaId) navigate(mapPath, { replace: true });
    },
    /** 지도에서 마커를 누르면 확대 단계는 그대로 두고 그 마커 자리를 가운데로 옮긴다. */
    focusPoint: (point: { latitude: number; longitude: number }) => {
      resultView.current = {
        latitude: point.latitude,
        longitude: point.longitude,
        level: resultView.current?.level ?? resultLevel,
      };
      setResultViewVersion((version) => version + 1);
    },
    /** 지도 검색(위쪽 검색창)으로 고른 장소. 지도를 그곳으로 옮기고 검색 핀을 찍을 뿐, 출퇴근 장소와 통근 분석은 바꾸지 않는다. */
    searchPin,
    searchTo: (address: MapAddress) => {
      setSearchPin({
        latitude: address.latitude,
        longitude: address.longitude,
        name: address.roadAddress ?? address.jibunAddress ?? address.address ?? '검색한 곳',
      });
      moveMapToPoint(address);
    },
    clearSearchPin: () => setSearchPin(null),
    /** 검색 핀의 `출퇴근 장소로 설정`. 이때만 지도 검색의 값이 출퇴근 장소로 복사된다. 분석은 따로 `이 조건으로 동네 찾기`로 한다. */
    setCommuteFromSearchPin: () => {
      if (!searchPin) return;
      selectAddressAsCommute({
        address: null,
        roadAddress: searchPin.name,
        jibunAddress: null,
        latitude: searchPin.latitude,
        longitude: searchPin.longitude,
      });
    },
    /** 주소 검색 결과처럼 고른 자리로 지도를 옮긴다. 조건을 고르는 중이든 결과를 보는 중이든 같은 자리로 가고, 확대 단계는 그대로 둔다. */
    moveMapTo: moveMapToPoint,
    /** 점들이 가려지지 않은 지도 칸에 모두 들어오게 옮긴다(`My`를 켰을 때 내 매물 전체). 한 점이면 동네를 볼 때의 가까운 단계로 둔다. */
    fitPoints: (points: { latitude: number; longitude: number }[]) => {
      if (!points.length) return;
      resultView.current = routeFocusView(points, [], readMapViewport());
      setResultViewVersion((version) => version + 1);
    },
    /** 출발 정류장(경로)을 고르면 그 정류장부터 출퇴근 장소까지 경로 전체가 한 화면에 들어오게 옮긴다. */
    focusRoute: (station: { latitude: number; longitude: number }) => {
      resultView.current = routeFocusView([station, destination], [], readMapViewport());
      setResultViewVersion((version) => version + 1);
    },
    selectStation: (id: string) => {
      if (!selected?.stations.some((station) => station.stopId === id) || id === selectedStopId) return;
      analytics.changeStation();
      setSelectedStopId(id);
    },
    openAreaDetails: () => {
      if (selected) navigate(neighborhoodAreaDetailsPath(mapPath, selected.adminDongCode));
    },
    closeAreaDetails: () => {
      if (selected) navigate(neighborhoodAreaPath(mapPath, selected.adminDongCode), { replace: true });
    },
    openListing: analytics.openListing,
    toggleMapCategory: analytics.toggleMapCategory,
    /** 결과 지도 칸 크기와 가리는 여백을 읽는 함수를 둔다. 화면이 지도 칸을 그린 뒤 한 번 넣는다. */
    setMapViewportReader: (reader: (() => MapViewport | null) | null) => {
      mapViewportReader.current = reader;
    },
  };
};
export default useNeighborhoodPreview;
export type NeighborhoodPreviewContext = ReturnType<typeof useNeighborhoodPreview>;
