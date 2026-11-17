import { useEffect, useMemo, useState } from 'react';

import { formatManwon } from '@/features/map/api/commuteApi';
import useViewportFacilityLayer from '@/features/map/hooks/useViewportFacilityLayer';
import type { MapCategory, MapMarker } from '@/features/map/model/Map';
import type { MapCanvasProps, MapRegion } from '@/features/map/model/MapCanvas';
import { usePropertyCommuteTimes, usePropertyList } from '@/features/property/api/useProperties';
import usePropertyMarkerPhotos from '@/features/property/hooks/usePropertyMarkerPhotos';
import { PROPERTY_PLACEHOLDER } from '@/shared/assets/propertyImageAssets';
import useDebouncedValue from '@/shared/lib/hooks/useDebouncedValue';

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

const useNeighborhoodMapView = (
  preview: NeighborhoodPreviewContext,
  { showAreaAction = true, onEmptyTap, deselectOnRegionTap = false, onSelectedRegionTap }: MapViewOptions = {},
) => {
  const isResultMap = !preview.isAnalyzing && !preview.error && !preview.isSelectingOnMap;
  const [railSelection, setRailSelection] = useState<RailSelection | null>(null);
  const facilityCategory = railSelection === 'MY' ? null : railSelection;
  const showsMy = railSelection === 'MY';
  const showsTransport = facilityCategory === 'TRANSPORT';
  // 중개사(전화, 카카오 링크가 있는 중개사 응답)와 교통(버스정류장 응답)은 화면 안 장소 조회로 받는다.
  // 병원, 편의점은 화면을 칸으로 나눠 받는다(`useViewportFacilityLayer`). 둘 다 가까이 확대했을 때만 받는다.
  const places = useNeighborhoodPlaces(isResultMap, {
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
  // `My`를 켜면 받은 매물 마커가 한 화면에 모두 들어오게 한 번 옮긴다. 다시 켤 때마다 한 번씩 맞춘다.
  const [hasFittedMy, setHasFittedMy] = useState(false);
  useEffect(() => {
    if (!showsMy) {
      setHasFittedMy(false);
      return;
    }
    if (hasFittedMy || myMarkers.length === 0) return;
    setHasFittedMy(true);
    preview.fitPoints(myMarkers);
  }, [showsMy, hasFittedMy, myMarkers, preview]);
  /** 레일 칸을 켜고 끈다. 같은 칸을 다시 누르면 끈다. 열어 둔 장소 정보는 닫는다. */
  const selectRail = (next: RailSelection) => {
    const value = railSelection === next ? null : next;
    preview.toggleMapCategory(next, value !== null);
    places.closePlace();
    setRailSelection(value);
  };
  const hasOpenLayer = places.selectedPlace !== null;
  const closeLayers = () => places.closePlace();
  /** 지도 빈 곳·고른 동네 안을 찍었을 때. 화면별 동작(시트 내리기) 또는 열린 정보 닫기를 한다. */
  const tapEmpty = () => {
    if (onEmptyTap) onEmptyTap();
    else if (hasOpenLayer) closeLayers();
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
  const railMarkers = useMemo<MapMarker[]>(() => {
    if (facilityCategory === 'AGENCY' || facilityCategory === 'TRANSPORT')
      return places.isClose
        ? places.markers.filter(
            (marker) => marker.category === facilityCategory && !marker.id.startsWith(STATION_PREFIX),
          )
        : NO_MARKERS;
    if (facilityCategory === 'HOSPITAL' || facilityCategory === 'CONVENIENCE')
      return places.isClose ? facilities.markers : NO_MARKERS;
    return myMarkers;
  }, [facilityCategory, places.isClose, places.markers, facilities.markers, myMarkers]);
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
        ? [{ ...preview.mapCandidate, id: 'candidate', label: DESTINATION_LABEL, tone: 'destination' as const }]
        : []),
    ],
    [preview.mapCandidate, preview.hasChosenMapPoint],
  );
  const mapProps: Pick<MapCanvasProps, 'center'> & Partial<MapCanvasProps> = isResultMap
    ? {
        center: preview.center,
        level: preview.resultLevel,
        markers: destinationMarkers,
        onCenterChange: preview.rememberResultCenter,
        onLevelChange: (level: number) => {
          preview.rememberResultLevel(level);
          places.rememberLevel(level);
        },
        onBoundsChange: places.rememberBounds,
        selectedMarkerId: places.selectedMarkerId,
        onSelectMarker: selectMarker,
        // 빈 곳을 찍으면 열어 둔 정보를 닫는다(휴대폰은 시트를 내린다).
        onSelectLocation: tapEmpty,
        regions: preview.regions,
        selectedRegionId: preview.selected?.adminDongCode,
        onSelectRegion: selectRegion,
        coordinateAction:
          showAreaAction && preview.selected && !hasOpenLayer
            ? {
                ...preview.selected.center,
                placement: 'above' as const,
                label: `${preview.selected.name} · 약 ${preview.selected.commuteMinutes}분${preview.selected.rent ? ` · 월세 ${formatManwon(preview.selected.rent.monthlyRentKrw)}` : ''}\n대중교통 정보 보기 →`,
                onClick: preview.openAreaDetails,
              }
            : undefined,
      }
    : {
        center: preview.selectionCenter,
        level: preview.selectionLevel,
        // 확대·축소 버튼이 지금 보이는 자리에서 옮기도록 움직인 시점을 기억한다.
        onCenterChange: preview.rememberSelectionCenter,
        onLevelChange: preview.rememberSelectionLevel,
        markers: candidateMarkers,
        regions: NO_REGIONS,
        // 분석 중이거나 실패 화면이 지도를 덮고 있을 때는 위치 찍기를 끈다.
        onSelectLocation: preview.isSelectingOnMap ? preview.chooseMapPoint : undefined,
      };
  return {
    isResultMap,
    mapProps,
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
      /** 시설 분류 아래에 붙이는 `My` 칸. */
      extraItems: [
        {
          key: 'MY',
          label: 'My',
          ariaLabel: `내 매물 통근 시간 ${showsMy ? '숨기기' : '표시하기'}`,
          selected: showsMy,
          onToggle: () => selectRail('MY'),
        },
      ],
    },
    /** 레일에서 켠 칸. 없으면 null이다. */
    railSelection,
    /** 시설 칸을 켰지만 멀리 보고 있어 시설을 받지 않는 중인지. 화면은 `가까이 확대하면 보여요`를 띄운다. */
    needsZoomForFacilities: facilityCategory !== null && !places.isClose,
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
