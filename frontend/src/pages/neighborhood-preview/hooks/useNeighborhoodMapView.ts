import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { useRecordsMapController } from '@/pages/design-records/RecordsMapProvider';
import { useAdminDongBookmarks } from '@/features/map/api/useAdminDongBookmarks';
import { useBookmarkedRegionRents } from '@/features/map/api/useBookmarkedRegionRents';
import { BOOKMARK_LABEL_HALF_HEIGHT, useBookmarkedRegions } from '@/features/map/api/useBookmarkedRegions';
import useMapTip from '@/features/map/hooks/useMapTip';
import useViewportFacilityLayer from '@/features/map/hooks/useViewportFacilityLayer';
import { bookmarkRentCardRows, rentOf, withRentCaptions } from '@/features/map/lib/bookmarkedRegionRent';
import {
  DESKTOP_FACILITY_MARKER_LEVEL,
  FACILITY_MARKER_LEVEL,
  facilityFocusLevel,
  facilityMarkersVisible,
} from '@/features/map/lib/mapFacilityVisibility';
import { groupMemberIds, groupOverlappingMarkers, propertyGroupMarker } from '@/features/map/lib/propertyMarkerGroups';
import type { MapBounds, MapCategory, MapMarker } from '@/features/map/model/Map';
import type { MapCanvasProps, MapRegion } from '@/features/map/model/MapCanvas';
import { useMapCanvasHost } from '@/features/map/ui/map-canvas/SharedMapCanvas';
import { usePropertyCommuteTimes } from '@/features/property/api/useProperties';
import { isPreviewProperty } from '@/features/property/model/sampleProperties';
import useDebouncedValue from '@/shared/lib/hooks/useDebouncedValue';
import useHoverIntent from '@/shared/lib/hooks/useHoverIntent';
import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';
import { setSheetCollapsed } from '@/shared/ui/bottom-sheet/sheetCollapse';
import { setDetailCollapsed } from '@/shared/ui/list-detail-layout/detailCollapse';

import { formatRentPair } from '../model/criteriaLabels';
import {
  cameFromFinderSummary,
  FINDER_FROM_SUMMARY_STATE,
  FINDER_PROPERTY_DETAIL,
  FINDER_PROPERTY_PARAM,
  FINDER_PROPERTY_VIEW_PARAM,
  parseFinderPropertyId,
} from '../model/finderPropertyUrl';
import { isFirstPromptEntry } from '../model/firstPromptEntry';
import { NEIGHBORHOOD_TAP_TIP_KEY } from '../model/mapTapTipKey';
import type { MyPropertyRow } from '../model/myProperty';
import { regionCardCode } from '../model/regionCardCode';
import useNeighborhoodPlaces, { MY_PROPERTY_PREFIX, type NeighborhoodPlace } from './useNeighborhoodPlaces';
import type { NeighborhoodPreviewContext } from './useNeighborhoodPreview';
import usePropertyRoute from './usePropertyRoute';

const NO_REGIONS: MapRegion[] = [];
const NO_MARKERS: MapMarker[] = [];
/** 고른 출퇴근 장소 말풍선 핀의 글자. 장소 이름은 검색창·찾기 버튼에 있으니 핀은 고른 자리만 알린다. */
const DESTINATION_LABEL = '선택한 지역';
/** 동네 출발 정류장 마커 id의 머리. 결과 지도에는 올리지 않아 화면 안 정류장과 겹치지 않게 거른다. */
const STATION_PREFIX = 'station:';

/**
 * 휴대폰·데스크탑 동네 찾기가 함께 쓰는 지도 설정. 위치 선택·분석·결과 내내 지도 하나를 유지하고 단계마다 넘기는 값만 바꾼다.
 * 단계마다 지도를 새로 만들면 GL 지도가 스타일·타일을 처음부터 다시 준비한다.
 */
type MapViewOptions = {
  /** 휴대폰은 고른 동네 위에 '대중교통 정보 보기' 말풍선을 띄운다. 데스크탑은 띄우지 않는다. */
  showAreaAction?: boolean;
  /** 지도 빈 곳이나 고른 동네 안을 찍었을 때 열린 정보를 닫는 대신 할 일. 휴대폰은 시트를 내린다. */
  onEmptyTap?: () => void;
  /** 이미 고른 동네 안을 다시 찍었을 때 빈 곳을 찍은 것으로 치는 대신 할 일. 휴대폰은 닫아 둔 동네 시트를 다시 연다. */
  onSelectedRegionTap?: () => void;
};

/** 결과 지도 레일에서 고르는 주변 시설 분류. 학교와 메모는 동네 찾기에 두지 않는다. */
export type FacilityCategory = 'AGENCY' | 'HOSPITAL' | 'TRANSPORT' | 'CONVENIENCE';
/** 레일에서 고르는 칸. 시설 분류에 더해 `MY`(회원이 기록한 매물)가 있다. */
export type RailSelection = FacilityCategory | 'MY';
export type { MyPropertyRow } from '../model/myProperty';
/** 레일 칸 순서. 중개사부터 둔다. */
export const RESULT_RAIL_ORDER: MapCategory[] = ['AGENCY', 'HOSPITAL', 'TRANSPORT', 'CONVENIENCE'];
export const RESULT_RAIL_LABELS: Partial<Record<MapCategory, string>> = { AGENCY: '중개사' };

/** 동 라벨 알약 높이의 절반(px). 눈대로 잡은 값이며 결과 지도에서 실측이 필요하다. */
const REGION_LABEL_HALF_HEIGHT = 18;
const SEARCH_PIN_ID = 'search-pin';
const BOOKMARK_REGION_PREFIX = 'bookmark:';
/** 출퇴근 장소 핀과 검색 핀. 찜한 동네만 보여 줄 때도 지우지 않는다. */
const isCommutePin = (marker: MapMarker) => marker.id === 'destination' || marker.id.startsWith(SEARCH_PIN_ID);
/** 내 매물 마커(하나 또는 겹쳐 묶인 무리). 찜한 동네만 보여 줄 때도 지우지 않는다. */
const isMyPropertyMarker = (marker: MapMarker) =>
  marker.id.startsWith(MY_PROPERTY_PREFIX) || groupMemberIds(marker.id) !== null;

const useNeighborhoodMapView = (
  preview: NeighborhoodPreviewContext,
  { showAreaAction = true, onEmptyTap, onSelectedRegionTap }: MapViewOptions = {},
) => {
  const recordsController = useRecordsMapController();
  const registration = preview.isPublicExplore ? null : recordsController?.layers;
  const isDesktop = useIsDesktop();
  // 로그인한 회원은 동네를 북마크해 내 기록 지도에서 다시 볼 수 있다.
  const bookmarks = useAdminDongBookmarks(!preview.isPublicExplore);
  // 찜 버튼은 동네 찾기에서 켜고 끄는 보기 전환이다. 켜면 찜한 동네만 칠하고 추천 동네와 주변 마커는 잠깐 숨긴다.
  // 내 기록 지도의 찜 층과 따로 두고, 기본은 꺼 둬 찾은 추천 동네가 먼저 보이게 한다.
  const [isBookmarkOnly, setIsBookmarkOnly] = useState(false);
  const hasBookmarks = bookmarks.codes.length > 0;
  const showsBookmarkOnly = isBookmarkOnly && hasBookmarks && registration != null;
  // 새로 찾기 시작하면 다시 추천 동네를 보여 준다.
  const [wasAnalyzing, setWasAnalyzing] = useState(preview.isAnalyzing);
  if (wasAnalyzing !== preview.isAnalyzing) {
    setWasAnalyzing(preview.isAnalyzing);
    if (preview.isAnalyzing) setIsBookmarkOnly(false);
  }
  const bookmarkRegions = useBookmarkedRegions(bookmarks.codes, showsBookmarkOnly);
  // 찜한 동네의 월세 시세. 이번 통근 결과에 든 동은 그 결과의 시세를 그대로 쓰고, 모자란 동만 따로 받는다.
  const bookmarkRents = useBookmarkedRegionRents(bookmarks.codes, showsBookmarkOnly);
  // 찜한 동네의 이름표를 눌러 연 `찜 해제하기` 카드의 동 코드.
  const [openBookmarkCode, setOpenBookmarkCode] = useState<string | null>(null);
  const openBookmarkRegion = showsBookmarkOnly
    ? bookmarkRegions.find((region) => region.id === openBookmarkCode)
    : undefined;
  const markerLevel = isDesktop ? DESKTOP_FACILITY_MARKER_LEVEL : FACILITY_MARKER_LEVEL;
  const isResultMap = !preview.isAnalyzing && !preview.error && !preview.isSelectingOnMap;
  // 내 매물 마커는 선택 전, 선택 중, 결과 단계 어디서나 눌려 같은 패널을 연다. 분석 중이거나 실패 화면이 지도를 덮은 동안만 닫아 둔다.
  const showsPropertyPanel = !preview.isAnalyzing && !preview.error;
  const [railSelection, setRailSelection] = useState<RailSelection | null>(null);
  // 누른 동네의 카드는 마우스를 치워도 띄워 둔다. 빈 곳이나 같은 동네를 다시 누르면 닫고, 그 동네 코드를 여기 둔다.
  const [dismissedCode, setDismissedCode] = useState<string | null>(null);
  const facilityCategory = railSelection === 'MY' ? null : railSelection;
  // 로그인한 회원은 동네 찾기에서도 기록한 매물을 늘 지도에 띄운다. 매물과 마커는 내 기록 지도가 쓰는 것(미리보기 매물 포함)을 그대로 쓴다.
  const recordsState = registration ? recordsController?.records : undefined;
  const showsMy = recordsState !== undefined;
  const showsTransport = facilityCategory === 'TRANSPORT';
  // 중개사(전화, 카카오 링크가 있는 중개사 응답)와 교통(버스정류장 응답)은 화면 안 장소 조회로 받는다.
  // 병원, 편의점은 화면을 칸으로 나눠 받는다(`useViewportFacilityLayer`). 둘 다 가까이 확대했을 때만 받는다.
  const places = useNeighborhoodPlaces(isResultMap, {
    markerLevel,
    loadsAgencies: facilityCategory === 'AGENCY',
    loadsBusStops: showsTransport,
  });
  // 병원, 편의점도 지도가 멈춘 뒤 잠깐 기다린 화면 범위로만 받는다. 멀거나 분류를 끄면 요청하지 않는다.
  const settledBounds = useDebouncedValue(places.isClose ? places.bounds : null, 300);
  const facilities = useViewportFacilityLayer(
    settledBounds,
    facilityCategory === 'HOSPITAL' || facilityCategory === 'CONVENIENCE' ? facilityCategory : null,
  );
  // 기록한 매물마다 이번 출퇴근 장소까지 통근 시간을 받는다. 미리보기 매물만 있으면 서버에 매물이 없어 부르지 않는다.
  const records = recordsState?.records;
  const hasRealRecords = records?.some((record) => !isPreviewProperty(record.id)) ?? false;
  const loadsCommutes = showsMy && isResultMap && hasRealRecords;
  const commuteTimes = usePropertyCommuteTimes(loadsCommutes ? preview.destination : null);
  const myRows = useMemo<MyPropertyRow[]>(() => {
    const commutes = new Map(commuteTimes.data?.properties.map((item) => [item.propertyId, item]) ?? []);
    return (records ?? []).map((record) => {
      const propertyId = Number(record.id);
      return {
        propertyId,
        name: record.name,
        depositAmount: record.summary.depositAmount,
        monthlyRentAmount: record.summary.monthlyRentAmount,
        address: record.summary.location.address,
        latitude: record.latitude,
        longitude: record.longitude,
        commute: commutes.get(propertyId) ?? null,
        representativePhoto: record.representativePhoto,
        summary: record.summary,
        isPreview: isPreviewProperty(propertyId),
      };
    });
  }, [records, commuteTimes.data]);
  const commuteMaxMinutes = commuteTimes.data?.maxMinutes ?? 60;
  // 마커는 내 기록 지도의 매물 마커(사진 카드와 월세)를 그대로 올리고, 동네 찾기의 다른 마커와 겹치지 않게 id에 머리를 붙인다.
  const recordMarkers = recordsState?.markers;
  const myMarkers = useMemo<MapMarker[]>(
    () =>
      recordMarkers?.map((marker) => ({ ...marker, id: `${MY_PROPERTY_PREFIX}${marker.id}`, appear: undefined })) ??
      NO_MARKERS,
    [recordMarkers],
  );
  /** 레일 칸을 켜고 끈다. 같은 칸을 다시 누르면 끈다. 열어 둔 장소 정보는 닫는다. */
  const selectRail = (next: RailSelection) => {
    const value = railSelection === next ? null : next;
    preview.toggleMapCategory(next, value !== null);
    if (
      value !== null &&
      !facilityMarkersVisible(isResultMap ? preview.resultLevel : preview.selectionLevel, markerLevel)
    )
      preview.zoomToFacilities(facilityFocusLevel(markerLevel));
    closeLayers();
    setRailSelection(value);
  };
  // 고른 내 매물은 주소(`?property=`)에 싣는다. 결과 지도를 보는 동안에만 되살리고, 기록이 올 때까지는 비워 둔다.
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const propertyId = parseFinderPropertyId(searchParams.get(FINDER_PROPERTY_PARAM));
  const pickedProperty =
    showsPropertyPanel && propertyId !== null ? myRows.find((row) => row.propertyId === propertyId) : undefined;
  const selectedPlace = useMemo<NeighborhoodPlace | null>(
    () => places.selectedPlace ?? (pickedProperty ? { kind: 'property', property: pickedProperty } : null),
    [places.selectedPlace, pickedProperty],
  );
  const selectedProperty = selectedPlace?.kind === 'property' ? selectedPlace.property : null;
  const isPropertyDetailOpen =
    selectedProperty !== null && searchParams.get(FINDER_PROPERTY_VIEW_PARAM) === FINDER_PROPERTY_DETAIL;
  // 같은 매물의 요약에서 상세로, 다른 매물 마커로 옮길 때는 기록을 새로 쌓지 않고 바꾼다. 처음 고를 때와 상세를 열 때만 쌓는다.
  const openProperty = (id: number) => {
    places.closePlace();
    setSearchParams({ [FINDER_PROPERTY_PARAM]: String(id) }, { replace: propertyId !== null });
  };
  const closeProperty = () => {
    if (!searchParams.has(FINDER_PROPERTY_PARAM) && !searchParams.has(FINDER_PROPERTY_VIEW_PARAM)) return;
    const next = new URLSearchParams(searchParams);
    next.delete(FINDER_PROPERTY_PARAM);
    next.delete(FINDER_PROPERTY_VIEW_PARAM);
    setSearchParams(next, { replace: true });
  };
  const openPropertyDetail = () => {
    if (selectedProperty === null) return;
    setSearchParams(
      {
        [FINDER_PROPERTY_PARAM]: String(selectedProperty.propertyId),
        [FINDER_PROPERTY_VIEW_PARAM]: FINDER_PROPERTY_DETAIL,
      },
      { state: FINDER_FROM_SUMMARY_STATE },
    );
  };
  /** 상세의 뒤로가기. 요약에서 들어왔으면 브라우저 뒤로가기와 같고, 주소로 바로 들어왔으면 요약으로 바꿔 둔다. */
  const closePropertyDetail = () => {
    if (cameFromFinderSummary(location.state)) void navigate(-1);
    else if (selectedProperty !== null)
      setSearchParams({ [FINDER_PROPERTY_PARAM]: String(selectedProperty.propertyId) }, { replace: true });
  };
  // 고른 내 매물에서 출퇴근 장소까지의 동선. 통근 시간이 나온 매물만 부르고 예시 매물은 부르지 않는다.
  // 시트의 노선 안내와 같은 쿼리(목적지 좌표와 매물 번호)라 한 번만 받는다.
  const routePropertyId =
    isResultMap &&
    selectedProperty !== null &&
    selectedProperty.isPreview !== true &&
    selectedProperty.commute?.status === 'REACHABLE'
      ? selectedProperty.propertyId
      : null;
  const propertyRoute = usePropertyRoute(preview, routePropertyId);
  const hasOpenLayer = selectedPlace !== null;
  const closeLayers = () => {
    places.closePlace();
    closeProperty();
  };
  /** 지도 빈 곳·고른 동네 안을 찍었을 때. 화면별 동작(시트 내리기) 또는 열린 정보 닫기를 한다. */
  const tapEmpty = () => {
    if (onEmptyTap) onEmptyTap();
    else if (hasOpenLayer) closeLayers();
    else setDismissedCode(preview.selected?.adminDongCode ?? null);
  };
  const tapMap = (latitude: number, longitude: number) => {
    // 결과를 보는 동안에는 열린 정보만 닫고 출퇴근 장소는 건드리지 않는다.
    if (!preview.canPickDestination) {
      tapEmpty();
      return;
    }
    // 고르는 중에 열어 둔 매물 패널은 새 위치를 고르면 닫는다.
    closeLayers();
    preview.chooseMapPoint(latitude, longitude);
  };
  /** 같은 동네를 다시 누르면 열어 둔 정보를 닫거나 다시 연다. 다른 동네는 한 번에 선택한다. */
  const selectRegion = (id: string) => {
    if (id === preview.selected?.adminDongCode) {
      if (onSelectedRegionTap) onSelectedRegionTap();
      // 같은 동네를 다시 누르면 띄워 둔 카드를 닫고, 닫혀 있으면 다시 띄운다.
      else if (!hasOpenLayer) setDismissedCode((current) => (current === id ? null : id));
      else tapEmpty();
      return;
    }
    setDismissedCode(null);
    closeLayers();
    preview.selectRegion(id, showAreaAction ? { focus: 'none' } : { openDetails: false, focus: 'none' });
  };
  /** 마커를 누르면 그 마커 하나의 정보를 열고 지도를 그 자리로 옮긴다. */
  const selectMarker = (marker: MapMarker) => {
    // 겹쳐 묶인 내 매물은 갈라져 보일 때까지 묶인 매물이 한 화면에 들어오게 다가간다. 내 기록 지도와 같은 묶음이다.
    const memberIds = groupMemberIds(marker.id);
    if (memberIds !== null) {
      closeLayers();
      preview.fitPoints(myMarkers.filter((member) => memberIds.includes(member.id)));
      return;
    }
    if (marker.id.startsWith(MY_PROPERTY_PREFIX)) {
      const row = myRows.find((item) => `${MY_PROPERTY_PREFIX}${item.propertyId}` === marker.id);
      if (row) {
        openProperty(row.propertyId);
        // 접어 둔 매물 패널을 펼치고, 패널에 가린 폭을 뺀 남은 지도 영역의 가운데로 그 매물을 옮긴다. 확대 단계는 그대로 둔다.
        setDetailCollapsed(false);
        // 휴대폰 매물 시트도 마커를 누르면 접힘을 풀고 연다.
        setSheetCollapsed(false);
        const center = recordsController?.centerBesidePanels(marker, preview.resultLevel, true) ?? marker;
        preview.focusPoint(center);
      }
      return;
    }
    closeProperty();
    const facility = facilities.placeOf(marker);
    if (facility) places.selectFacility(marker, facility);
    else places.selectMarker(marker);
    if (isResultMap) preview.focusPoint(marker);
  };
  // 시설 마커는 레일 칸을 켰고 가까이 확대했을 때 지금 화면 범위로 받은 것만 올린다. 동네를 골라도 따로 마커를 받지 않는다.
  // 아무 칸도 켜지 않으면 동네 경계와 출퇴근 장소 핀만 남는다. 거리 메모는 동네 찾기에 띄우지 않는다.
  // 내 기록 지도와 같은 기준으로, 화면에서 포개질 만큼 가까운 내 매물은 묶어 개수만 보인다.
  const groupedMyMarkers = useMemo(
    () => groupOverlappingMarkers(myMarkers, places.bounds).map(propertyGroupMarker),
    [myMarkers, places.bounds],
  );
  const facilityMarkers = useMemo<MapMarker[]>(() => {
    if (facilityCategory === 'AGENCY' || facilityCategory === 'TRANSPORT')
      return places.isClose
        ? places.markers.filter(
            (marker) => marker.category === facilityCategory && !marker.id.startsWith(STATION_PREFIX),
          )
        : NO_MARKERS;
    if (facilityCategory === 'HOSPITAL' || facilityCategory === 'CONVENIENCE')
      return places.isClose ? facilities.markers : NO_MARKERS;
    return NO_MARKERS;
  }, [facilityCategory, places.isClose, places.markers, facilities.markers]);
  // 내 매물은 시설 칸을 켜도 함께 둔다. 매물 사진 카드(종류 순서 8)가 시설 핀(5) 위에 오고,
  // 출퇴근 장소 핀과 검색 핀(말풍선 라벨, 12)은 매물보다 위에 온다.
  const railMarkers = useMemo(
    () => (groupedMyMarkers.length === 0 ? facilityMarkers : [...facilityMarkers, ...groupedMyMarkers]),
    [facilityMarkers, groupedMyMarkers],
  );
  const destinationMarkers = useMemo(
    () => [
      ...railMarkers,
      // 결과 지도의 출퇴근 장소도 장소를 고를 때와 같은 말풍선 라벨 핀으로 둬, 내 매물 사진 카드보다 위에 온다.
      {
        ...preview.destination,
        id: 'destination',
        label: DESTINATION_LABEL,
        caption: '출퇴근 장소',
        tone: 'pinLabel' as const,
        pinKind: 'commute' as const,
      },
    ],
    [railMarkers, preview.destination],
  );
  // 출퇴근 장소를 고르거나 검색하는 동안에는 위치만 보인다. 내 매물은 결과가 나온 뒤에 올린다.
  const candidateMarkers = useMemo(
    () => [
      ...(preview.hasChosenMapPoint
        ? // 목적지를 고른 방법으로 핀을 가른다: 검색은 이름이 붙은 검은 핀, 지도를 눌러 고른 곳은 점선 고리가 있는 작은 핀.
          // 분석은 이 마커와 같은 좌표(`mapCandidate`)로 요청한다. 새로 고르면 이전 마커는 같은 id라 바뀐다.
          [
            {
              latitude: preview.mapCandidate.latitude,
              longitude: preview.mapCandidate.longitude,
              id: 'destination',
              // 출퇴근 장소 마커: 진한 파란 라벨에 `출퇴근 장소`와 이름. 지도 검색 핀(흰 라벨)과 모양이 달라 한눈에 구분된다.
              label: preview.mapCandidate.name || '선택한 위치',
              caption: '출퇴근 장소',
              tone: 'pinLabel' as const,
              pinKind: 'commute' as const,
            },
          ]
        : preview.hasSubmittedSearch
          ? [{ ...preview.destination, id: 'destination', label: DESTINATION_LABEL, tone: 'destination' as const }]
          : []),
    ],
    [preview.mapCandidate, preview.hasChosenMapPoint, preview.hasSubmittedSearch, preview.destination],
  );
  // 위치를 고르기 전, 지도 가운데 좌표에 붙는 첫 안내. 위치를 고르거나 검색을 시작하면 잠시 숨기고, 선택 모드에서는 안내 띠가 같은 말을 한다.
  const tip = useMapTip({
    storageKey: NEIGHBORHOOD_TAP_TIP_KEY,
    message: '지도를 눌러 출퇴근 장소를 골라요',
    point: preview.selectionCenter,
    offsetPx: isDesktop ? undefined : { x: 0, y: -64 },
    level: preview.selectionLevel,
    enabled:
      preview.isSelectingOnMap &&
      !preview.isMapSelectionEnabled &&
      !preview.hasChosenMapPoint &&
      !preview.query.trim() &&
      preview.addressResults.length === 0,
  });
  // 내 기록의 첫 안내(배너, 칩)로 들어왔을 때만 한 번, 첫 안내 말풍선 자리로 지도를 옮기고 확대한다.
  // 선택 모드 진입이나 다른 입구(모드 버튼, 마이 바로가기, 주소 직접 입력)는 이 길을 타지 않아 보던 지도를 그대로 둔다.
  // 공용 지도는 모드를 바꿀 때 내 기록의 가운데를 붙잡아 두므로, 일부러 옮기는 이때만 놓아 준다.
  const mapHost = useMapCanvasHost();
  const fromFirstPrompt = isFirstPromptEntry(location.state);
  // 들어온 순간 한 번만 옮긴다. 말풍선이나 지도 시점이 바뀌어도 다시 부르지 않도록 최신 값은 ref로 읽는다.
  const focusFirstTip = useRef(() => undefined);
  focusFirstTip.current = () => {
    mapHost?.releaseHeldView();
    preview.focusFirstTip(tip ?? preview.selectionCenter);
  };
  useEffect(() => {
    if (!fromFirstPrompt) return;
    focusFirstTip.current();
    navigate(location.pathname + location.search, { replace: true, state: null });
  }, [fromFirstPrompt, navigate, location.pathname, location.search]);
  // 구역 위 마우스 상태. 올리고 잠깐(HOVER_SHOW_DELAY_MS) 머물러야 카드가 뜨고, 나간 뒤 잠깐(HOVER_HIDE_DELAY_MS) 기다려 카드로 옮겨 가도 닫히지 않게 한다.
  const regionHover = useHoverIntent<string>();
  const hoveredCode = regionHover.target;
  const holdCard = regionHover.hold;
  const releaseCard = regionHover.leave;
  const hoverRegion = (id: string, isHovered: boolean) => {
    if (isHovered) regionHover.enter(id);
    else regionHover.leave();
  };
  // 누른 동네의 카드는 마우스를 치워도 그 동네 중심에 그대로 둔다. 눌러 고정한 동네가 있으면 다른 동네에 마우스를 올려도 카드를 띄우지 않고(영역 강조만 남는다),
  // 고정한 동네가 없을 때만 마우스를 올린 동네의 카드가 뜬다. 그래서 카드는 늘 하나다.
  const selectedCode = preview.selected?.adminDongCode ?? null;
  const pinnedCode = showAreaAction && selectedCode !== dismissedCode ? selectedCode : null;
  const cardCode = regionCardCode(pinnedCode, hoveredCode);
  const areaOf = (code: string | null) =>
    code === null ? undefined : preview.resultAreas.find((area) => area.adminDongCode === code);
  const cardArea = areaOf(cardCode);
  /** 동네의 정보 카드. 동 라벨(알약)은 좌표가 가운데라 높이의 절반만큼 위에서 꼬리가 닿는다. */
  const areaCardAction = (
    area: NonNullable<typeof cardArea>,
    onHoverChange?: (isHovered: boolean) => void,
  ): NonNullable<MapCanvasProps['coordinateAction']> => ({
    ...area.center,
    placement: 'above' as const,
    label: area.name,
    onClick: () => undefined,
    onHoverChange,
    card: {
      markerAbove: REGION_LABEL_HALF_HEIGHT,
      markerBelow: REGION_LABEL_HALF_HEIGHT,
      title: area.name,
      // 북마크는 로그인한 회원만 쓴다. 공개 탐색은 별을 숨긴다.
      bookmark: preview.isPublicExplore
        ? undefined
        : {
            isOn: bookmarks.isBookmarked(area.adminDongCode),
            onToggle: () => bookmarks.toggle(area.adminDongCode),
          },
      rows: [
        { label: '소요시간', value: `${area.commuteMinutes}분`, tone: 'primary' as const },
        area.rent
          ? { label: '월세 시세', value: formatRentPair(area.rent) }
          : { label: '월세 시세', value: '정보 없음', isEmpty: true },
      ],
    },
  });
  // 찜한 동네는 월세 라벨에 표시한다(별과 연한 파랑). 찜 목록을 아는 이 자리에서 한 번만 붙인다.
  const bookmarkedCodes = bookmarks.codes;
  const savedAwareRegions = useMemo(() => {
    if (bookmarkedCodes.length === 0) return preview.regions;
    const saved = new Set(bookmarkedCodes);
    return preview.regions.map((region) =>
      region.rentLabel && saved.has(region.id)
        ? { ...region, rentLabel: { ...region.rentLabel, isBookmarked: true } }
        : region,
    );
  }, [bookmarkedCodes, preview.regions]);
  // 위쪽 지도 검색에서 고른 위치는 핀을 누르면 출퇴근 장소로 설정된다.
  const searchPinMarker: MapMarker[] = preview.searchPin
    ? [
        {
          latitude: preview.searchPin.latitude,
          longitude: preview.searchPin.longitude,
          id: SEARCH_PIN_ID,
          label: preview.searchPin.name,
          tone: 'pinLabel' as const,
          pinKind: 'search' as const,
          actionable: true,
        },
      ]
    : [];
  const selectSearchPin = (marker: MapMarker) => {
    if (marker.id === SEARCH_PIN_ID) preview.setCommuteFromSearchPin();
  };
  const mapProps: Pick<MapCanvasProps, 'center'> & Partial<MapCanvasProps> = isResultMap
    ? {
        center: preview.center,
        level: preview.resultLevel,
        markers: [...destinationMarkers, ...searchPinMarker],
        onCenterChange: preview.rememberResultCenter,
        onLevelChange: (level: number) => {
          preview.rememberResultLevel(level);
          places.rememberLevel(level);
        },
        onBoundsChange: (bounds: MapBounds) => {
          preview.rememberMapBounds(bounds);
          places.rememberBounds(bounds);
        },
        selectedMarkerId: selectedProperty
          ? `${MY_PROPERTY_PREFIX}${selectedProperty.propertyId}`
          : places.selectedMarkerId,
        onSelectMarker: (marker: MapMarker) => {
          if (marker.id.startsWith(SEARCH_PIN_ID)) selectSearchPin(marker);
          else selectMarker(marker);
        },
        onSelectLocation: tapMap,
        regions: savedAwareRegions,
        selectedRegionId: preview.selected?.adminDongCode,
        onSelectRegion: selectRegion,
        // 데스크탑: 동 라벨이나 구역에 마우스를 올리면 동 이름, 소요시간, 월세 시세 카드가 그 자리에 뜬다. 모바일은 아래 시트가 같은 내용을 맡는다.
        onHoverRegion: showAreaAction ? hoverRegion : undefined,
        // 호버 카드에만 마우스 유지 처리를 붙인다. 눌러 고정한 카드는 마우스와 상관없이 남는다.
        coordinateAction:
          showAreaAction && cardArea && !hasOpenLayer
            ? areaCardAction(
                cardArea,
                pinnedCode === null ? (isHovered) => (isHovered ? holdCard() : releaseCard()) : undefined,
              )
            : undefined,
      }
    : {
        center: preview.selectionCenter,
        level: preview.selectionLevel,
        // 확대·축소 버튼이 지금 보이는 자리에서 옮기도록 움직인 시점을 기억한다.
        onCenterChange: preview.rememberSelectionCenter,
        onLevelChange: preview.rememberSelectionLevel,
        onBoundsChange: preview.rememberMapBounds,
        // 내 매물은 선택 전과 선택 중에도 눌러 결과 지도와 같은 패널을 연다. 눌림은 마커에서 막혀 출퇴근 장소를 바꾸지 않고, 지도 빈 곳이 출퇴근 장소 후보가 된다.
        markers: [...candidateMarkers, ...searchPinMarker, ...groupedMyMarkers],
        // 출퇴근 장소를 다시 고르는 동안에는 이전 결과의 동 영역을 지운다. 새로 찾아야 다시 그려지고, 이전 결과 보기로 돌아오면 그대로 복원된다.
        regions: NO_REGIONS,
        tip,
        // 분석 중이거나 실패 화면이 지도를 덮고 있을 때는 위치 찍기를 끈다.
        onSelectLocation: preview.isSelectingOnMap ? tapMap : undefined,
        onSelectRegion: preview.isSelectingOnMap
          ? (_, point) => {
              if (point) tapMap(point.latitude, point.longitude);
            }
          : undefined,
        onSelectMarker: (marker: MapMarker) => {
          if (marker.id.startsWith(SEARCH_PIN_ID)) selectSearchPin(marker);
          else if (isMyPropertyMarker(marker)) selectMarker(marker);
        },
        // 고른 매물을 표시하고, 시설 분류 카드도 매물을 골랐을 때 함께 선다.
        selectedMarkerId: selectedProperty ? `${MY_PROPERTY_PREFIX}${selectedProperty.propertyId}` : null,
      };
  const baseSelectMarker = mapProps.onSelectMarker;
  const baseBoundsChange = mapProps.onBoundsChange;
  const baseLevelChange = mapProps.onLevelChange;
  const composedProps: MapCanvasProps = registration
    ? {
        ...mapProps,
        bookmarkControl: {
          count: bookmarks.codes.length,
          isOn: showsBookmarkOnly,
          isDisabled: !hasBookmarks,
          onToggle: () => {
            if (!hasBookmarks) return;
            setOpenBookmarkCode(null);
            closeLayers();
            setIsBookmarkOnly((current) => !current);
          },
        },
        // 찜한 동네만 볼 때는 찜한 영역이 또렷하게 보이도록 시설, 메모 같은 주변 마커를 걷는다.
        // 출퇴근 장소 핀과 내 매물은 찜한 동네와 견줘 볼 대상이라 남긴다.
        markers: showsBookmarkOnly
          ? (mapProps.markers ?? []).filter((marker) => isCommutePin(marker) || isMyPropertyMarker(marker))
          : [
              ...(mapProps.markers ?? []),
              ...(registration.canvasProps.markers ?? []).filter((marker) => marker.category === 'MEMO'),
            ],
        // 찜한 동네만 볼 때는 추천 동네 대신 찜한 동네를 칠한다. 통근 결과 구역과 id가 겹치지 않게 접두어를 붙인다.
        regions: showsBookmarkOnly
          ? withRentCaptions(bookmarkRegions, bookmarkRents).map((region) => ({
              ...region,
              id: `${BOOKMARK_REGION_PREFIX}${region.id}`,
            }))
          : (mapProps.regions ?? []),
        selectedRegionId: showsBookmarkOnly ? null : mapProps.selectedRegionId,
        onHoverRegion: showsBookmarkOnly ? undefined : mapProps.onHoverRegion,
        // 동네 찾기에서는 지도를 눌러도 메모 남기기, 본 방 기록하기 메뉴를 띄우지 않는다.
        coordinateMenu: undefined,
        onSelectLocation: mapProps.onSelectLocation
          ? (latitude, longitude) => {
              setOpenBookmarkCode(null);
              mapProps.onSelectLocation?.(latitude, longitude);
            }
          : undefined,
        onSelectRegion: (id, point) => {
          if (id.startsWith(BOOKMARK_REGION_PREFIX)) {
            const code = id.slice(BOOKMARK_REGION_PREFIX.length);
            // 칠한 영역을 누르면 지도 빈 곳을 누른 것과 같다. 동 이름표를 누를 때만(좌표 없이) `찜 해제하기` 카드를 띄운다.
            if (point) {
              setOpenBookmarkCode(null);
              tapMap(point.latitude, point.longitude);
              return;
            }
            setOpenBookmarkCode((current) => (current === code ? null : code));
            return;
          }
          mapProps.onSelectRegion?.(id, point);
        },
        coordinateAction:
          openBookmarkRegion?.center === undefined
            ? showsBookmarkOnly
              ? undefined
              : mapProps.coordinateAction
            : {
                ...openBookmarkRegion.center,
                placement: 'above' as const,
                label: openBookmarkRegion.name,
                onClick: () => undefined,
                card: {
                  markerAbove: BOOKMARK_LABEL_HALF_HEIGHT,
                  markerBelow: BOOKMARK_LABEL_HALF_HEIGHT,
                  title: openBookmarkRegion.name,
                  action: {
                    label: '찜 해제하기',
                    onClick: () => {
                      bookmarks.toggle(openBookmarkRegion.id);
                      setOpenBookmarkCode(null);
                    },
                  },
                  ...bookmarkRentCardRows(rentOf(bookmarkRents, openBookmarkRegion.id)),
                },
              },
        onSelectMarker: (marker) => {
          if (marker.category === 'MEMO') registration.canvasProps.onSelectMarker?.(marker);
          else baseSelectMarker?.(marker);
        },
        onLevelChange: (level) => {
          baseLevelChange?.(level);
          recordsController?.setInteractionLevel(level);
        },
        onBoundsChange: (bounds) => {
          baseBoundsChange?.(bounds);
          registration.canvasProps.onBoundsChange?.(bounds);
        },
      }
    : mapProps;
  return {
    isResultMap,
    /** 찜한 동네만 보는 중인지. 추천 동네를 지도에서 걷는 동안에는 화면도 찾은 동네 뱃지 줄을 숨긴다. */
    showsBookmarkOnly,
    showsPropertyPanel,
    mapProps: composedProps,
    bookmark: (code: string) =>
      preview.isPublicExplore
        ? undefined
        : {
            isOn: bookmarks.isBookmarked(code),
            onToggle: () => bookmarks.toggle(code),
          },
    places: selectedPlace === places.selectedPlace ? places : { ...places, selectedPlace },
    /** 고른 내 매물과 그 매물의 동선. 데스크탑 옆 칸과 휴대폰 시트가 함께 쓴다. */
    property: {
      selected: selectedProperty,
      /** 출퇴근 장소가 정해진 결과 단계인지. 아니면 노선 대신 안내만 보인다. */
      hasDestination: isResultMap,
      route: propertyRoute,
      commuteMaxMinutes,
      isDetailOpen: isPropertyDetailOpen,
      openDetail: openPropertyDetail,
      closeDetail: closePropertyDetail,
      close: closeLayers,
    },
    /** 결과 지도 오른쪽에 처음부터 두는 분류 레일(중개사, 병원, 교통, 편의, My)의 값. */
    rail: {
      selectedCategories: (facilityCategory ? [facilityCategory] : []) as MapCategory[],
      onToggle: (category: MapCategory) => {
        if (category === 'AGENCY' || category === 'HOSPITAL' || category === 'TRANSPORT' || category === 'CONVENIENCE')
          selectRail(category);
      },
      order: RESULT_RAIL_ORDER,
      labels: RESULT_RAIL_LABELS,
    },
    /** 레일에서 켠 칸. 없으면 null이다. */
    railSelection,
    /** 기록한 매물을 지도에 띄우는 중인지(로그인한 회원). */
    showsMy,
    /** 시설 칸을 켰지만 멀리 보고 있어 시설을 받지 않는 중인지. 화면은 `가까이 확대하면 보여요`를 띄운다. */
    needsZoomForFacilities: isResultMap && !facilityMarkersVisible(preview.resultLevel, markerLevel),
    /** 켠 레일 칸을 끈다(My 목록을 닫았을 때). */
    clearRail: () => {
      if (railSelection !== null) selectRail(railSelection);
    },
    /** `My`를 켰을 때의 매물과 통근 시간. */
    my: {
      rows: myRows,
      maxMinutes: commuteMaxMinutes,
      isLoading: showsMy && (recordsState.properties.isPending || (loadsCommutes && commuteTimes.isPending)),
      isError: (recordsState?.properties.isError ?? false) || commuteTimes.isError,
    },
    /** My 목록에서 매물을 고르면 지도 마커를 누른 것처럼 그 매물 정보를 열고 그 자리로 옮긴다. */
    selectMyProperty: (row: MyPropertyRow) => {
      openProperty(row.propertyId);
      if (row.latitude !== null && row.longitude !== null)
        preview.focusPoint({ latitude: row.latitude, longitude: row.longitude });
    },
    /** 동네·조건을 바꾸거나 다시 고를 때 열어 둔 정보를 닫는다. */
    closeLayers,
  };
};

export default useNeighborhoodMapView;
