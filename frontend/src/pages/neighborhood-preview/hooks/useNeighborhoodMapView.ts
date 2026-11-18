import { useMemo, useState } from 'react';

import { useRecordsMapController } from '@/pages/design-records/RecordsMapProvider';
import { useAdminDongBookmarks } from '@/features/map/api/useAdminDongBookmarks';
import useMapTip from '@/features/map/hooks/useMapTip';
import useViewportFacilityLayer from '@/features/map/hooks/useViewportFacilityLayer';
import {
  DESKTOP_FACILITY_MARKER_LEVEL,
  FACILITY_MARKER_LEVEL,
  facilityFocusLevel,
  facilityMarkersVisible,
} from '@/features/map/lib/mapFacilityVisibility';
import type { MapCoordinate } from '@/features/map/lib/mapLocation';
import { groupMemberIds, groupOverlappingMarkers, propertyGroupMarker } from '@/features/map/lib/propertyMarkerGroups';
import type { MapCategory, MapMarker } from '@/features/map/model/Map';
import type { MapCanvasProps, MapRegion } from '@/features/map/model/MapCanvas';
import { usePropertyCommuteTimes, usePropertyList } from '@/features/property/api/useProperties';
import usePropertyMarkerPhotos from '@/features/property/hooks/usePropertyMarkerPhotos';
import { PROPERTY_PLACEHOLDER } from '@/shared/assets/propertyImageAssets';
import useDebouncedValue from '@/shared/lib/hooks/useDebouncedValue';
import useHoverIntent from '@/shared/lib/hooks/useHoverIntent';
import useIsDesktop from '@/shared/lib/hooks/useIsDesktop';

import { formatRentPair } from '../model/criteriaLabels';
import { SHOW_RECORDED_PROPERTIES_ON_FINDER } from '../model/finderMapOptions';
import { NEIGHBORHOOD_TAP_TIP_KEY } from '../model/mapTapTipKey';
import type { MyPropertyRow } from '../model/myProperty';
import { propertyCommuteLabel } from '../model/propertyCommute';
import useNeighborhoodPlaces, { MY_PROPERTY_PREFIX } from './useNeighborhoodPlaces';
import type { NeighborhoodPreviewContext } from './useNeighborhoodPreview';

const NO_REGIONS: MapRegion[] = [];
const NO_MARKERS: MapMarker[] = [];
const NO_PHOTO_SOURCES: Parameters<typeof usePropertyMarkerPhotos>[0] = [];
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
  /** 동네를 고른 채 지도의 동네(같은 동네든 다른 동네든)를 찍으면 동네 선택을 푼다. 휴대폰은 시트를 닫는다. */
  deselectOnRegionTap?: boolean;
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

const useNeighborhoodMapView = (
  preview: NeighborhoodPreviewContext,
  { showAreaAction = true, onEmptyTap, deselectOnRegionTap = false, onSelectedRegionTap }: MapViewOptions = {},
) => {
  const recordsController = useRecordsMapController();
  const registration = preview.isPublicExplore ? null : recordsController?.layers;
  const isDesktop = useIsDesktop();
  // 로그인한 회원은 동네를 북마크해 내 기록 지도에서 다시 볼 수 있다.
  const bookmarks = useAdminDongBookmarks(!preview.isPublicExplore);
  const markerLevel = isDesktop ? DESKTOP_FACILITY_MARKER_LEVEL : FACILITY_MARKER_LEVEL;
  const isResultMap = !preview.isAnalyzing && !preview.error && !preview.isSelectingOnMap;
  const [commutePoint, setCommutePoint] = useState<MapCoordinate | null>(null);
  const [railSelection, setRailSelection] = useState<RailSelection | null>(null);
  const facilityCategory = railSelection === 'MY' ? null : railSelection;
  // 로그인한 회원은 동네 찾기에서도 기록한 매물을 늘 지도에 띄우고, 매물마다 이번 출퇴근 장소까지 걸리는 시간을 적는다.
  const showsMy = SHOW_RECORDED_PROPERTIES_ON_FINDER && !preview.isPublicExplore;
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
  // `My`를 켜면 기록한 매물과 이번 출퇴근 장소까지 통근 시간을 받는다. 공개 동네 찾기는 로그인 전이라 부르지 않는다.
  const loadsMy = showsMy && isResultMap && !preview.isPublicExplore;
  const propertyList = usePropertyList(loadsMy);
  const commuteTimes = usePropertyCommuteTimes(loadsMy ? preview.destination : null);
  const myRows = useMemo<MyPropertyRow[]>(() => {
    const commutes = new Map(commuteTimes.data?.properties.map((item) => [item.propertyId, item]) ?? []);
    return (propertyList.data?.pages ?? [])
      .flatMap((page) => page.content)
      .map((property) => ({
        propertyId: property.propertyId,
        name: property.name,
        depositAmount: property.depositAmount,
        monthlyRentAmount: property.monthlyRentAmount,
        address: property.location.address,
        latitude: property.location.latitude,
        longitude: property.location.longitude,
        commute: commutes.get(property.propertyId) ?? null,
        representativePhoto: property.representativePhoto,
      }));
  }, [propertyList.data, commuteTimes.data]);
  const commuteMaxMinutes = commuteTimes.data?.maxMinutes ?? 60;
  const myPhotoUrls = usePropertyMarkerPhotos(
    showsMy
      ? myRows.map((row) => ({
          id: row.propertyId,
          latitude: row.latitude,
          longitude: row.longitude,
          representativePhoto: row.representativePhoto,
        }))
      : NO_PHOTO_SOURCES,
  );
  const myMarkers = useMemo<MapMarker[]>(
    () =>
      showsMy
        ? myRows.flatMap((row) =>
            row.latitude === null || row.longitude === null
              ? []
              : [
                  {
                    id: `${MY_PROPERTY_PREFIX}${row.propertyId}`,
                    latitude: row.latitude,
                    longitude: row.longitude,
                    label: row.name,
                    // 매물 핀 금액 자리에 이번 출퇴근 장소까지 통근 시간을 적는다.
                    summary: {
                      amount: row.commute ? propertyCommuteLabel(row.commute, commuteMaxMinutes) : '…',
                    },
                    tone: 'property' as const,
                    actionable: true,
                    photo: myPhotoUrls.get(String(row.propertyId)) ?? PROPERTY_PLACEHOLDER.src2x,
                  },
                ],
          )
        : NO_MARKERS,
    [showsMy, myRows, commuteMaxMinutes, myPhotoUrls],
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
  const hasOpenLayer = places.selectedPlace !== null;
  const closeLayers = () => {
    places.closePlace();
    setCommutePoint(null);
  };
  /** 지도 빈 곳·고른 동네 안을 찍었을 때. 화면별 동작(시트 내리기) 또는 열린 정보 닫기를 한다. */
  const tapEmpty = () => {
    setCommutePoint(null);
    if (onEmptyTap) onEmptyTap();
    else if (hasOpenLayer) closeLayers();
  };
  const tapMap = (latitude: number, longitude: number) => {
    if (isResultMap && (hasOpenLayer || preview.selected)) {
      tapEmpty();
      return;
    }
    if (preview.isSelectingOnMap && preview.isMapSelectionEnabled) {
      setCommutePoint(null);
      preview.chooseMapPoint(latitude, longitude);
      return;
    }
    setCommutePoint({ latitude, longitude });
  };
  /** 지도의 동네를 찍었을 때. 이미 고른 동네 안을 다시 찍으면 열어 둔 정보만 닫고, 다른 동네를 찍으면 동네를 바꾼다. */
  const selectRegion = (id: string) => {
    if (deselectOnRegionTap && preview.selected) {
      closeLayers();
      preview.selectRegion(null);
      return;
    }
    if (id === preview.selected?.adminDongCode) {
      if (onSelectedRegionTap) onSelectedRegionTap();
      else tapEmpty();
      return;
    }
    closeLayers();
    preview.selectRegion(id, showAreaAction ? { focus: 'none' } : { openDetails: false, focus: 'none' });
  };
  /** 마커를 누르면 그 마커 하나의 정보를 열고 지도를 그 자리로 옮긴다. */
  const selectMarker = (marker: MapMarker) => {
    // 겹쳐 묶인 내 매물은 갈라져 보일 때까지 묶인 매물이 한 화면에 들어오게 다가간다. 내 기록 지도와 같은 묶음이다.
    const memberIds = groupMemberIds(marker.id);
    if (memberIds !== null) {
      places.closePlace();
      preview.fitPoints(myMarkers.filter((member) => memberIds.includes(member.id)));
      return;
    }
    if (marker.id.startsWith(MY_PROPERTY_PREFIX)) {
      const row = myRows.find((item) => `${MY_PROPERTY_PREFIX}${item.propertyId}` === marker.id);
      if (row) places.selectProperty(row);
    } else {
      const facility = facilities.placeOf(marker);
      if (facility) places.selectFacility(marker, facility);
      else places.selectMarker(marker);
    }
    preview.focusPoint(marker);
  };
  // 시설 마커는 레일 칸을 켰고 가까이 확대했을 때 지금 화면 범위로 받은 것만 올린다. 동네를 골라도 따로 마커를 받지 않는다.
  // 아무 칸도 켜지 않으면 동네 경계와 출퇴근 장소 핀만 남는다. 거리 메모는 동네 찾기에 띄우지 않는다.
  // 내 기록 지도와 같은 기준으로, 화면에서 포개질 만큼 가까운 내 매물은 묶어 개수만 보인다.
  const groupedMyMarkers = useMemo(
    () => groupOverlappingMarkers(myMarkers, places.bounds).map(propertyGroupMarker),
    [myMarkers, places.bounds],
  );
  const railMarkers = useMemo<MapMarker[]>(() => {
    if (facilityCategory === 'AGENCY' || facilityCategory === 'TRANSPORT')
      return places.isClose
        ? places.markers.filter(
            (marker) => marker.category === facilityCategory && !marker.id.startsWith(STATION_PREFIX),
          )
        : NO_MARKERS;
    if (facilityCategory === 'HOSPITAL' || facilityCategory === 'CONVENIENCE')
      return places.isClose ? facilities.markers : NO_MARKERS;
    return groupedMyMarkers;
  }, [facilityCategory, places.isClose, places.markers, facilities.markers, groupedMyMarkers]);
  const destinationMarkers = useMemo(
    () => [
      ...railMarkers,
      { ...preview.destination, id: 'destination', label: DESTINATION_LABEL, tone: 'destination' as const },
    ],
    [railMarkers, preview.destination],
  );
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
  // 위치를 고르기 전, 지도 가운데 좌표에 붙는 첫 안내. 위치를 고르거나 검색을 시작하면 잠시 숨긴다.
  const tip = useMapTip({
    storageKey: NEIGHBORHOOD_TAP_TIP_KEY,
    message: '지도를 눌러 출퇴근 장소를 골라요',
    point: preview.selectionCenter,
    enabled:
      preview.isSelectingOnMap &&
      !commutePoint &&
      !preview.hasChosenMapPoint &&
      !preview.query.trim() &&
      preview.addressResults.length === 0,
  });
  // 구역 위 마우스 상태. 올리고 잠깐(HOVER_SHOW_DELAY_MS) 머물러야 카드가 뜨고, 나간 뒤 잠깐(HOVER_HIDE_DELAY_MS) 기다려 카드로 옮겨 가도 닫히지 않게 한다.
  const regionHover = useHoverIntent<string>();
  const hoveredCode = regionHover.target;
  const holdCard = regionHover.hold;
  const releaseCard = regionHover.leave;
  const hoverRegion = (id: string, isHovered: boolean) => {
    if (isHovered) regionHover.enter(id);
    else regionHover.leave();
  };
  const hoveredArea =
    hoveredCode === null ? undefined : preview.resultAreas.find((area) => area.adminDongCode === hoveredCode);
  // 지도 검색(위쪽 검색창)의 검색 핀. 흰 라벨에 `출퇴근 장소로 설정` 작은 버튼이 있고, 라벨을 누르면 지운다.
  const searchPinMarker: MapMarker[] = preview.searchPin
    ? [
        {
          latitude: preview.searchPin.latitude,
          longitude: preview.searchPin.longitude,
          id: SEARCH_PIN_ID,
          label: preview.searchPin.name,
          tone: 'pinLabel' as const,
          pinKind: 'search' as const,
          removable: true,
          setsCommute: true,
          actionable: true,
        },
      ]
    : [];
  const selectSearchPin = (marker: MapMarker) => {
    if (marker.id === `${SEARCH_PIN_ID}:set-commute`) preview.setCommuteFromSearchPin();
    else if (marker.id === SEARCH_PIN_ID) preview.clearSearchPin();
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
        onBoundsChange: places.rememberBounds,
        selectedMarkerId: places.selectedMarkerId,
        onSelectMarker: (marker: MapMarker) => {
          setCommutePoint(null);
          if (marker.id.startsWith(SEARCH_PIN_ID)) selectSearchPin(marker);
          else selectMarker(marker);
        },
        onSelectLocation: tapMap,
        regions: preview.regions,
        selectedRegionId: preview.selected?.adminDongCode,
        onSelectRegion: selectRegion,
        // 데스크탑: 동 라벨이나 구역에 마우스를 올리면 동 이름, 소요시간, 월세 시세 카드가 그 자리에 뜬다. 모바일은 아래 시트가 같은 내용을 맡는다.
        onHoverRegion: showAreaAction ? hoverRegion : undefined,
        coordinateAction:
          showAreaAction && hoveredArea && !hasOpenLayer
            ? {
                ...hoveredArea.center,
                placement: 'above' as const,
                label: hoveredArea.name,
                onClick: () => undefined,
                onHoverChange: (isHovered: boolean) => (isHovered ? holdCard() : releaseCard()),
                card: {
                  // 동 라벨(알약)은 좌표가 가운데라 높이의 절반만큼 위에서 꼬리가 닿는다.
                  markerAbove: REGION_LABEL_HALF_HEIGHT,
                  markerBelow: REGION_LABEL_HALF_HEIGHT,
                  title: hoveredArea.name,
                  // 북마크는 로그인한 회원만 쓴다. 공개 탐색은 별을 숨긴다.
                  bookmark: preview.isPublicExplore
                    ? undefined
                    : {
                        isOn: bookmarks.isBookmarked(hoveredArea.adminDongCode),
                        onToggle: () => bookmarks.toggle(hoveredArea.adminDongCode),
                      },
                  rows: [
                    { label: '소요시간', value: `${hoveredArea.commuteMinutes}분`, tone: 'primary' as const },
                    hoveredArea.rent
                      ? { label: '월세 시세', value: formatRentPair(hoveredArea.rent) }
                      : { label: '월세 시세', value: '정보 없음', isEmpty: true },
                  ],
                },
              }
            : undefined,
      }
    : {
        center: preview.selectionCenter,
        level: preview.selectionLevel,
        // 확대·축소 버튼이 지금 보이는 자리에서 옮기도록 움직인 시점을 기억한다.
        onCenterChange: preview.rememberSelectionCenter,
        onLevelChange: preview.rememberSelectionLevel,
        markers: [...candidateMarkers, ...searchPinMarker],
        regions: preview.hasSubmittedSearch ? preview.regions : NO_REGIONS,
        tip,
        // 분석 중이거나 실패 화면이 지도를 덮고 있을 때는 위치 찍기를 끈다.
        onSelectLocation: preview.isSelectingOnMap ? tapMap : undefined,
        onSelectRegion: preview.isSelectingOnMap
          ? (_, point) => {
              if (point) tapMap(point.latitude, point.longitude);
            }
          : undefined,
        onSelectMarker: selectSearchPin,
      };
  const baseSelectMarker = mapProps.onSelectMarker;
  const baseBoundsChange = mapProps.onBoundsChange;
  const baseLevelChange = mapProps.onLevelChange;
  const composedProps: MapCanvasProps = registration
    ? {
        ...mapProps,
        markers: [
          ...(mapProps.markers ?? []),
          ...(registration.canvasProps.markers ?? []).filter((marker) => marker.category === 'MEMO'),
        ],
        // 찜한 동네는 행정동 경계 안쪽을 칠해 두 지도에 같은 모양으로 보인다. 통근 결과 구역과 id가 겹치지 않게 접두어를 붙이고, 눌러도 고르지 않는다.
        regions: [
          ...(mapProps.regions ?? []),
          ...(registration.canvasProps.regions ?? []).map((region) => ({
            ...region,
            id: `${BOOKMARK_REGION_PREFIX}${region.id}`,
          })),
        ],
        // 동네 찾기에서는 지도를 눌러도 메모 남기기, 본 방 기록하기 메뉴를 띄우지 않는다.
        coordinateMenu: undefined,
        onSelectRegion: (id, point) => {
          if (id.startsWith(BOOKMARK_REGION_PREFIX)) return;
          mapProps.onSelectRegion?.(id, point);
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
    mapProps: {
      ...composedProps,
      coordinateAction:
        commutePoint && !hasOpenLayer && !preview.isMapSelectionEnabled && (preview.isSelectingOnMap || isResultMap)
          ? {
              ...commutePoint,
              placement: 'above',
              label: '출퇴근 장소로 설정',
              onClick: () => {
                setCommutePoint(null);
                preview.chooseMapPoint(commutePoint.latitude, commutePoint.longitude);
              },
            }
          : composedProps.coordinateAction,
    } satisfies MapCanvasProps,
    places,
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
      isLoading: loadsMy && (propertyList.isPending || commuteTimes.isPending),
      isError: propertyList.isError || commuteTimes.isError,
    },
    /** My 목록에서 매물을 고르면 지도 마커를 누른 것처럼 그 매물 정보를 열고 그 자리로 옮긴다. */
    selectMyProperty: (row: MyPropertyRow) => {
      places.selectProperty(row);
      if (row.latitude !== null && row.longitude !== null)
        preview.focusPoint({ latitude: row.latitude, longitude: row.longitude });
    },
    /** 동네·조건을 바꾸거나 다시 고를 때 열어 둔 정보를 닫는다. */
    closeLayers,
  };
};

export default useNeighborhoodMapView;
