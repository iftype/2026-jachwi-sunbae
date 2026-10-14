import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { ApiError } from '@/features/auth/api/apiClient';
import { fetchAdminBoundaries, fetchBoundaryManifest } from '@/features/map/api/adminBoundaryApi';
import { commuteAreaToRegion, fetchCommuteAreas } from '@/features/map/api/commuteApi';
import { fetchCommuteRoute } from '@/features/map/api/commuteRouteApi';
import { fetchLegalBoundaries, nearbyLegalBoundaries } from '@/features/map/api/legalBoundaryApi';
import { reverseGeocode } from '@/features/map/api/mapApi';
import { fetchRentalAverage } from '@/features/map/api/rentalApi';
import { readGeolocationPermission, requestCurrentMapLocation } from '@/features/map/lib/mapLocation';
import { type MapCoordinate, MapLocationError } from '@/features/map/lib/mapLocation';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';

import { commuteColor } from '../model/commuteColors';
import { PREVIEW_DESTINATION } from '../model/preview';

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
  const mode = searchParams.get('mode') === 'price' ? 'price' : 'commute';
  const [phase, setPhase] = useState<'map' | 'conditions' | 'analyzing'>('map');
  const [destination, setDestination] = useState(PREVIEW_DESTINATION);
  const [mapCandidate, setMapCandidate] = useState(PREVIEW_DESTINATION);
  const [selectionCenter, setSelectionCenter] = useState(PREVIEW_DESTINATION);
  const [selectionLevel, setSelectionLevel] = useState(6);
  const resultView = useRef<{ latitude: number; longitude: number; level: number } | null>(null);
  const [hasChosenMapPoint, setHasChosenMapPoint] = useState(false);
  const [shouldFocusMapSearch, setShouldFocusMapSearch] = useState(false);
  const locationIntent = useRef(0);
  const [currentPosition, setCurrentPosition] = useState<MapCoordinate | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [maxMinutes, setMaxMinutes] = useState(60);
  const [maxTransfers, setMaxTransfers] = useState(2);
  const isValidCommuteTime =
    Number.isInteger(maxMinutes) && maxMinutes >= 5 && maxMinutes <= 180 && maxMinutes % 5 === 0;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
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
        setDestination(current);
        setMapCandidate(current);
        setSelectionCenter(current);
        setHasChosenMapPoint(true);
        setPhase('conditions');
      } catch {
        // 위치를 못 받으면 기본 지도에서 직접 찍도록 유지한다.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const commute = useQuery({
    queryKey: [
      'commute-areas',
      config.apiBaseUrl,
      destination.latitude,
      destination.longitude,
      maxMinutes,
      maxTransfers,
    ],
    queryFn: async ({ signal }) => {
      const [result, boundaries] = await Promise.all([
        fetchCommuteAreas(config, destination, maxMinutes, maxTransfers, signal),
        fetchBoundaryManifest(config.boundaryBaseUrl, signal).then((manifest) =>
          client.ensureQueryData({
            queryKey: ['admin-boundaries', manifest.file, config.boundaryBaseUrl],
            queryFn: ({ signal }) => fetchAdminBoundaries(manifest, config.boundaryBaseUrl, signal),
            staleTime: Infinity,
            gcTime: 30 * 60 * 1000,
            retry: false,
          }),
        ),
      ]);
      return {
        ...result,
        areas: result.areas.map((area) => ({
          ...area,
          name: boundaries[area.adminDongCode]?.name ?? area.adminDongCode,
          fullName: boundaries[area.adminDongCode]?.fullName ?? '경계 정보가 없는 동네',
          center: boundaries[area.adminDongCode]?.center ?? area.center,
          polygons: boundaries[area.adminDongCode]?.polygons ?? [],
        })),
      };
    },
    enabled: phase === 'analyzing' && mode === 'commute',
    retry: false,
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
    retry: false,
  });
  const priceAreas = mode === 'price' ? (price.data ?? []) : [];
  const selectedPrice = priceAreas.find((area) => area.legalDongCode === selectedId);
  const areas = mode === 'commute' ? commute.data?.areas : undefined;
  const selected = areas?.find((area) => area.adminDongCode === selectedId);
  const selectedStation = selected?.stations.find((station) => station.stopId === selectedStopId);
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
            summary: { price: area.average === null ? '정보 없음' : `${Math.round(area.average / 10000)}만원` },
          }))
        : (areas ?? []).map((area) => ({
            ...commuteAreaToRegion(area),
            appearance: commuteColor(area.commuteMinutes, maxMinutes),
          })),
    [areas, maxMinutes, mode, priceAreas],
  );
  const matchesDestination = `${PREVIEW_DESTINATION.name} ${PREVIEW_DESTINATION.address}`.includes(query.trim());
  return {
    priceAreas,
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
          setSelectionLevel(6);
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
      navigate('/neighborhoods');
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
      resultView.current = null;
      setSelectedId(null);
      setSelectedStopId(null);
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
    changeQuery: (value: string) => {
      locationIntent.current += 1;
      setQuery(value);
      setHasChosenMapPoint(false);
      setPhase('map');
    },
    matchesDestination,
    searchDestination: () => {
      if (!query.trim() || !matchesDestination) return;
      locationIntent.current += 1;
      setMapCandidate(PREVIEW_DESTINATION);
      setSelectionCenter(PREVIEW_DESTINATION);
      setDestination(PREVIEW_DESTINATION);
      setHasChosenMapPoint(true);
      setShouldFocusMapSearch(false);
      setPhase('conditions');
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
    retry: () => (mode === 'price' ? price.refetch() : commute.refetch()),
    maxMinutes,
    isValidCommuteTime,
    changeMaxMinutes: setMaxMinutes,
    maxTransfers,
    changeMaxTransfers: setMaxTransfers,
    resultLevel: resultView.current?.level ?? (mode === 'price' ? 8 : 10),
    center:
      resultView.current ??
      (areas?.length
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
        : (priceAreas[0]?.center ?? destination)),
    reset: () => {
      if (location.pathname.includes('/areas/')) navigate(`/neighborhoods/map?mode=${mode}`, { replace: true });
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
      setSelectedId(id);
      setSelectedStopId(areas?.find((area) => area.adminDongCode === id)?.stations[0]?.stopId ?? null);
      if (id && mode === 'commute') navigate(`/neighborhoods/map/areas/${id}?mode=${mode}`);
    },
    selectStation: setSelectedStopId,
  };
};
export default useNeighborhoodPreview;
export type NeighborhoodPreviewContext = ReturnType<typeof useNeighborhoodPreview>;
