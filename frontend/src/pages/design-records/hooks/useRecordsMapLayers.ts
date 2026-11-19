import { useMemo, useRef, useState } from 'react';

import { reverseGeocode } from '@/features/map/api/mapApi';
import { useAdminDongBookmarks } from '@/features/map/api/useAdminDongBookmarks';
import { useBookmarkedRegions } from '@/features/map/api/useBookmarkedRegions';
import useMapTip from '@/features/map/hooks/useMapTip';
import {
  groupOverlappingMarkers,
  propertyGroupMarker,
  RECORD_GROUP_PREFIX,
} from '@/features/map/lib/propertyMarkerGroups';
import type { MapAddress, MapBounds, MapMarker } from '@/features/map/model/Map';
import type { MapCanvasProps, MapCoordinateMenu, MapTapAction } from '@/features/map/model/MapCanvas';
import { isPreviewProperty } from '@/features/property/model/sampleProperties';
import useStreetMemoLayer from '@/features/street-memo/hooks/useStreetMemoLayer';
import { MEMO_INDIVIDUAL_MAX_LEVEL } from '@/features/street-memo/lib/streetMemoDongGroups';
import { focusOnMemos } from '@/features/street-memo/lib/streetMemoFocus';
import { MENU_MEMO_ICON, MENU_PROPERTY_ICON, PROPERTY_PLACEHOLDER } from '@/shared/assets/propertyImageAssets';
import { usePublicConfig } from '@/shared/config/PublicConfigContext';
import { useLogger } from '@/shared/lib/analytics/logging';

import { readBookmarkLayerOn, writeBookmarkLayerOn } from '../model/bookmarkLayer';
import { FIRST_PROPERTY_TIP_KEY, RECORDS_TAP_TIP_KEY, SHOW_FIRST_PROPERTY_TIP } from '../model/mapTapTipKey';
import { nearestMarkerAt } from '../model/nearestMarker';
import { SEARCHED_PIN_IMAGE } from '../model/searchedPin';
import type { RecordsState } from './useRecords';

const REGISTER_MARKER_ID = 'register-point';
const SEARCHED_MARKER_ID = 'searched-point';
/** 이 단계보다 멀리 축소하면 거리 메모를 숨긴다. 도시 전체를 볼 때는 골목 메모가 쓸모없다. */
const MEMO_MAX_LEVEL = 11;

type MapPoint = { latitude: number; longitude: number };

type Options = {
  interactionLevel?: number;
  onRecommend?: (location: MapAddress) => void;
  /**
   * 찍은 위치에서 매물 등록을 고르면 주소 응답을 기다린 뒤에 넘긴다. 등록 화면을 여는 방식은 화면이 정한다.
   * 주소를 찾지 못했거나 조회가 실패하면 주소 없이 좌표만 넘긴다. 넘기지 않으면 찍은 위치에서는 메모만 남긴다.
   */
  onRegister?: (location: MapAddress) => void;
  /** 매물 등록 칸을 연 위치. 등록하는 동안 그 자리에 집과 더하기 그림 핀을 둔다. */
  registeringAt?: MapPoint | null;
  /**
   * 켜면 빈 곳을 눌러도 열어 둔 매물, 목록, 메모를 닫지 않는다(데스크탑은 옆 칸에 목록과 상세가 열려 있어 갑자기 사라지면 당황스럽다).
   * 열린 동작 말풍선만 닫고, 없으면 그 자리의 동작 말풍선을 연다.
   */
  keepSelectionOnMapTap?: boolean;
  /** 거리 메모를 낱개로, 그리고 보이게 하는 가장 먼 확대 단계를 이만큼 더 멀리 잡는다. 화면이 넓은 데스크탑이 1을 준다. */
  memoLevelBoost?: number;
  /**
   * 겹친 매물 묶음을 눌렀을 때. `list`는 묶인 매물을 함께 늘어놓고(휴대폰 바텀시트), `zoom`은 핀이 갈라져 보일 때까지 다가간다.
   * 데스크탑은 리스트에 이미 모든 매물이 보여, 묶음을 따로 늘어놓지 않고 다가가기만 한다.
   */
  groupAction?: 'list' | 'zoom';
};

const sameBounds = (a: MapBounds | null, b: MapBounds) =>
  a !== null && a.south === b.south && a.north === b.north && a.west === b.west && a.east === b.east;

/**
 * 본 방 기록 지도 위에 얹는 겹. 늘 켜 둔 거리 메모와 찍은 위치의 동작(메모 남기기, 매물 등록)을 맡는다.
 * 시설 분류(병원, 교통, 학교, 편의)는 동네 찾기 결과 지도로 옮겨, 이 지도에는 분류 레일을 두지 않는다.
 * 데스크탑·휴대폰 지도가 함께 쓰고, 지도 위 조작을 어디에 어떻게 놓을지는 각 화면의 지도 컴포넌트가 정한다.
 */
const useRecordsMapLayers = (
  records: RecordsState,
  {
    onRegister,
    onRecommend,
    interactionLevel,
    registeringAt = null,
    groupAction = 'list',
    keepSelectionOnMapTap = false,
    memoLevelBoost = 0,
  }: Options,
) => {
  const config = usePublicConfig();
  // 동네 찾기에서 북마크한 동네를 지도에 칠하는 층. 버튼으로 켜고 끈다.
  const bookmarkStore = useAdminDongBookmarks();
  // 저장한 값이 없으면 찜한 동네가 있을 때 기본으로 칠한다.
  const [storedBookmarkLayerOn, setStoredBookmarkLayerOn] = useState(readBookmarkLayerOn);
  const isBookmarkLayerOn = storedBookmarkLayerOn ?? true;
  const bookmarkRegions = useBookmarkedRegions(bookmarkStore.codes, isBookmarkLayerOn);
  // 칠한 찜한 동네를 누르면 그 자리에 동 이름과 별 카드를 띄워 거기서 찜을 해제한다.
  const [openBookmarkCode, setOpenBookmarkCode] = useState<string | null>(null);
  const openBookmarkRegion = bookmarkRegions.find((region) => region.id === openBookmarkCode);
  // 매물 상세에서 주소를 바꿀 때, 옆의 큰 지도를 눌러 새 자리를 고르는 모드. 상세는 저장 함수를 맡기고, 고른 자리와 저장은 이 겹이 맡는다.
  const [pickRequest, setPickRequest] = useState<{ onSave: (address: MapAddress) => Promise<void> } | null>(null);
  const [picked, setPicked] = useState<{ status: 'geocoding' | 'ready' | 'error'; address: MapAddress } | null>(null);
  const [isPickSaving, setIsPickSaving] = useState(false);
  const [hasPickSaveFailed, setHasPickSaveFailed] = useState(false);
  const pickIntent = useRef(0);
  const endPick = () => {
    pickIntent.current += 1;
    setPickRequest(null);
    setPicked(null);
    setIsPickSaving(false);
    setHasPickSaveFailed(false);
  };
  const pickAt = (latitude: number, longitude: number) => {
    const intent = ++pickIntent.current;
    const base: MapAddress = { address: null, roadAddress: null, jibunAddress: null, latitude, longitude };
    setHasPickSaveFailed(false);
    setPicked({ status: 'geocoding', address: base });
    reverseGeocode(config, latitude, longitude).then(
      (address) => {
        if (intent === pickIntent.current) setPicked({ status: 'ready', address: { ...address, latitude, longitude } });
      },
      () => {
        if (intent === pickIntent.current) setPicked({ status: 'error', address: base });
      },
    );
  };
  const { log } = useLogger();
  const { level } = records;
  const memoLevel = interactionLevel ?? level;
  // 겹쳐 묶인 매물 마커를 눌러 함께 보는 매물들의 id. 하나만 고른 매물은 records.selected로 따로 둔다.
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const hasSelection = records.selected !== undefined || groupIds.length > 0;
  const closeSelection = () => {
    records.setSelectedId(null);
    setGroupIds([]);
  };
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  // 찍은 자리. `매물 추가` 버튼으로 연 자리는 매물 등록만 고르게 한다.
  const [tapPoint, setTapPoint] = useState<MapPoint | null>(null);
  // 매물 등록을 누른 뒤 주소를 찾는 중인 위치. 응답이 늦어도 그 자리에 등록 핀을 먼저 두고, 그동안 다시 등록하지 못하게 한다.
  const [resolvingAt, setResolvingAt] = useState<MapPoint | null>(null);
  // 주소를 찾는 동안과 매물을 만드는 동안 그 자리에 등록 핀을 둔다.
  const pinAt = registeringAt ?? resolvingAt;
  const isRegistering = pinAt !== null;
  // 현재 위치로 이동한 뒤 "여기서 매물을 추가할까요?"를 물을 자리.
  // 지도 왼쪽 아래 `동네 추천받기`를 켠 상태. 켜고 지도를 누르면 그 자리로 추천을 시작하고 꺼진다.
  const [isRecommending, setIsRecommending] = useState(false);
  const [suggestAt, setSuggestAt] = useState<MapPoint | null>(null);
  // 거리 메모는 버튼 없이 늘 띄운다. 아주 멀리 축소했을 때만 숨긴다.
  const memo = useStreetMemoLayer(
    memoLevel <= MEMO_MAX_LEVEL + memoLevelBoost,
    bounds,
    memoLevel,
    MEMO_INDIVIDUAL_MAX_LEVEL + memoLevelBoost,
  );

  const markers = useMemo<MapMarker[]>(
    () => [
      ...memo.markers,
      ...(picked === null
        ? []
        : [
            {
              latitude: picked.address.latitude,
              longitude: picked.address.longitude,
              id: 'picked-location',
              label: '새 위치',
              tone: 'selected' as const,
              image: SEARCHED_PIN_IMAGE,
            },
          ]),
      ...(records.searchedPoint === null
        ? []
        : [
            {
              latitude: records.searchedPoint.latitude,
              longitude: records.searchedPoint.longitude,
              id: SEARCHED_MARKER_ID,
              label: records.searchedPoint.name,
              tone: 'pinLabel' as const,
              pinKind: 'search' as const,
              actionable: true,
            },
          ]),
      ...(pinAt === null
        ? []
        : [
            {
              latitude: pinAt.latitude,
              longitude: pinAt.longitude,
              id: REGISTER_MARKER_ID,
              // 만들어지는 동안에도 완성될 매물과 같은 사진 카드로 둬, 옛 핀이 잠깐 보였다 바뀌지 않게 한다.
              label: '새 매물',
              summary: { amount: '0만' },
              tone: 'property' as const,
              photo: PROPERTY_PLACEHOLDER.src2x,
            },
          ]),
    ],
    [memo.markers, pinAt, records.searchedPoint, picked],
  );

  /**
   * 주소 응답을 기다린 뒤 매물을 만든다. 예전에는 기다리는 동안 아무 표시가 없어 다시 누르면 매물이 둘 생겼다.
   * 주소를 찾지 못했거나 조회가 실패해도 등록은 막지 않고 주소 없이 좌표만으로 만든다.
   */
  const registerAt = (point: MapPoint) => {
    setTapPoint(null);
    if (isRegistering) return;
    setResolvingAt(point);
    const withoutAddress: MapAddress = { address: null, roadAddress: null, jibunAddress: null, ...point };
    reverseGeocode(config, point.latitude, point.longitude)
      .then(
        (address) => onRegister?.({ ...address, ...point }),
        () => onRegister?.(withoutAddress),
      )
      .finally(() => setResolvingAt(null));
  };
  /**
   * 현재 위치로 이동했을 때 부른다. 등록 중이 아니면 추가를 제안한다.
   * 한 건물에 여러 자취방이 있을 수 있어 같은 자리에 기록한 매물이 있어도 제안한다.
   */
  const suggestRegisterAt = (coordinate: MapPoint) => {
    if (!onRegister || isRegistering) return;
    setSuggestAt({ latitude: coordinate.latitude, longitude: coordinate.longitude });
  };
  const tapActions: MapTapAction[] =
    tapPoint === null
      ? []
      : [
          {
            id: 'street-memo',
            label: '메모 남기기',
            icon: MENU_MEMO_ICON,
            onSelect: () => {
              log('map_coordinate_action_selected', { action: 'memo' });
              setTapPoint(null);
              closeSelection();
              memo.startDraft(tapPoint);
            },
          },
          ...(onRegister
            ? [
                {
                  id: 'property',
                  label: '본 방 기록하기',
                  icon: MENU_PROPERTY_ICON,
                  onSelect: () => {
                    log('map_coordinate_action_selected', { action: 'property' });
                    registerAt(tapPoint);
                  },
                },
              ]
            : []),
        ];

  const recordGroups = useMemo(() => groupOverlappingMarkers(records.markers, bounds), [records.markers, bounds]);
  const recordMarkers = useMemo(() => recordGroups.map(propertyGroupMarker), [recordGroups]);
  // 함께 보는 매물(겹친 무리)이나 하나만 고른 매물이 든 마커를 고른 것으로 표시한다. 배율을 바꿔 무리가 달라져도 따라간다.
  const shownIds = groupIds.length > 0 ? groupIds : records.selected ? [records.selected.id] : [];
  const selectedRecordMarkerId =
    shownIds.length === 0
      ? null
      : (recordMarkers[recordGroups.findIndex((group) => group.some((marker) => marker.id === shownIds[0]))]?.id ??
        null);

  const selectMarker = (marker: MapMarker): boolean => {
    const memos = memo.memosOf(marker);
    if (marker.id.startsWith(RECORD_GROUP_PREFIX)) {
      memo.close();
      setTapPoint(null);
      records.setSelectedId(null);
      const ids = marker.id.slice(RECORD_GROUP_PREFIX.length).split(',');
      if (groupAction === 'list') {
        setGroupIds(ids);
        return true;
      }
      // 겹친 메모처럼 묶인 핀이 갈라져 보일 만큼 다가간다.
      const focus = focusOnMemos(
        records.markers.filter((record) => ids.includes(record.id)),
        bounds,
        level,
      );
      records.setCenter(focus.center);
      records.setLevel(focus.level);
      return true;
    }
    // 행정동 메모 묶음은 열지 않고 묶음 자리(동 메모 평균 좌표)로 메모가 하나씩 보이는 단계까지 확대한다.
    if (memo.isDongGroup(marker)) {
      memo.close();
      setTapPoint(null);
      closeSelection();
      records.setCenter({ latitude: marker.latitude, longitude: marker.longitude });
      records.setLevel(MEMO_INDIVIDUAL_MAX_LEVEL + memoLevelBoost);
      return true;
    }
    if (!memo.selectMarker(marker)) return false;
    setTapPoint(null);
    closeSelection();
    // 누른 메모가 화면을 채우도록 다가간다.
    if (memos.length > 0) {
      const focus = focusOnMemos(memos, bounds, level);
      records.setCenter(focus.center);
      records.setLevel(focus.level);
    }
    return true;
  };
  /**
   * 빈 곳을 찍으면, 열린 매물·메모·동작 버튼이 있으면 닫기만 하고 아니면 그 자리에서 할 일을 고르게 한다.
   * 무언가를 닫으려고 찍었는데 바로 새 동작이 뜨면 다시 닫아야 해서 두 단계로 나눈다.
   */
  const tapLocation = (latitude: number, longitude: number) => {
    setOpenBookmarkCode(null);
    // 주소를 바꾸는 중에는 지도를 눌러 새 자리를 고르기만 한다.
    if (pickRequest !== null) {
      pickAt(latitude, longitude);
      return;
    }
    // 매물을 등록하는 동안은 새 동작을 띄우지 않는다.
    if (isRegistering) return;
    if (isRecommending && onRecommend) {
      setIsRecommending(false);
      closeSelection();
      memo.close();
      setTapPoint(null);
      onRecommend({ latitude, longitude, address: null, roadAddress: null, jibunAddress: null });
      return;
    }
    if (keepSelectionOnMapTap) {
      setTapPoint(tapPoint === null ? { latitude, longitude } : null);
      return;
    }
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
    // 지도를 옮기면 찍은 자리 말풍선을 닫는다.
    setTapPoint(null);
  };
  // 첫 안내는 미리보기 매물 마커가 있으면 그 마커에, 없으면 지도 가운데 좌표에 붙인다.
  const previewMarker = records.markers.find((marker) => isPreviewProperty(marker.id));
  const tip = useMapTip({
    storageKey: RECORDS_TAP_TIP_KEY,
    message: previewMarker
      ? '이렇게 방을 기록해요. 빈 곳을 눌러 메모도 남겨요'
      : '지도를 눌러 메모를 남기거나 본 방을 기록해요',
    placement: previewMarker ? 'below' : 'above',
    point: previewMarker ?? records.center,
    // 마커에서 화면 기준 아래로 약 70px 비껴 둬, 말풍선을 눌러도 마커와 겹치지 않고 마커는 그대로 보인다.
    offsetPx: previewMarker ? { x: 0, y: 70 } : undefined,
    level: records.level,
    enabled: records.selected === undefined && memo.mode === null && !isRegistering,
  });
  // 첫 매물을 등록한 직후 한 번, 방금 생긴 그 마커에 붙는 말풍선. 지도 아무 곳이나 누르거나 끌면 닫히고 다시 안 뜬다.
  // 판단은 이 세션에서 방금 만든 매물(`createdId`)이면서 기록이 그 하나뿐일 때다. 두 번째 매물부터는 안 뜬다.
  const createdMarker =
    records.createdId === null ? undefined : records.markers.find((marker) => marker.id === records.createdId);
  const realRecordCount = records.records.filter((record) => !isPreviewProperty(record.id)).length;
  const firstPropertyTip = useMapTip({
    storageKey: FIRST_PROPERTY_TIP_KEY,
    message: '기록했어요. 눌러서 체크리스트와 사진을 채워 보세요',
    placement: 'below',
    point: createdMarker ?? records.center,
    // 마커에서 화면 기준 아래로 약 40px 비껴 둬 방금 생긴 마커를 가리지 않는다.
    offsetPx: createdMarker ? { x: 0, y: 40 } : undefined,
    level: records.level,
    enabled: SHOW_FIRST_PROPERTY_TIP && createdMarker !== undefined && realRecordCount === 1,
  });
  const allMarkers = useMemo(() => [...recordMarkers, ...markers], [recordMarkers, markers]);
  /** 메모 마커와 겹친 매물 묶음이 아니면 기록한 방 하나의 마커다. */
  const selectMapMarker = (marker: MapMarker) => {
    // 검색한 곳의 라벨(×)을 누르면 그 표시를 지운다.
    if (marker.id === SEARCHED_MARKER_ID) {
      records.clearSearchedPoint();
      return;
    }
    if (selectMarker(marker)) return;
    memo.close();
    setTapPoint(null);
    setGroupIds([]);
    records.showRecord(marker.id);
  };
  /** 두 화면의 지도가 그대로 넘기는 MapCanvas 설정. 찍은 자리 말풍선(coordinateMenu)은 데스크탑만 더한다. */
  const canvasProps = {
    // 동네 뱃지, 현재 위치, 매물 넘기기로 지도를 옮길 때 부드럽게 이동한다.
    animateView: true,
    interactive: true,
    center: records.center,
    level: records.level,
    markers: allMarkers,
    selectedMarkerId: selectedRecordMarkerId ?? memo.selectedMarkerId,
    onSelectMarker: selectMapMarker,
    onSelectLocation: tapLocation,
    onCenterChange: (latitude: number, longitude: number) => records.setCenter({ latitude, longitude }),
    onLevelChange: records.setLevel,
    onBoundsChange: rememberBounds,
    tip: firstPropertyTip ?? tip,
    regions: bookmarkRegions,
    // 찜한 동네의 칠한 영역을 누르면 지도 빈 곳을 누른 것과 같다(메모 남기기, 본 방 기록하기).
    // 찜한 동네 위의 기록과 메모를 눌러도 구역이 먼저 눌릴 수 있어, 누른 자리 아래 마커가 있으면 그 마커의 말풍선을 연다.
    // 동 이름 라벨을 누를 때만 좌표 없이 불려, 그때 동 이름과 별 카드를 띄워 거기서 찜을 해제한다.
    onSelectRegion: (id: string, point?: MapPoint) => {
      if (point) {
        const marker = nearestMarkerAt(allMarkers, point, bounds);
        if (marker) {
          setOpenBookmarkCode(null);
          selectMapMarker(marker);
          return;
        }
        tapLocation(point.latitude, point.longitude);
        return;
      }
      setTapPoint(null);
      setOpenBookmarkCode((current) => (current === id ? null : id));
    },
    coordinateAction:
      openBookmarkRegion?.center === undefined
        ? undefined
        : {
            ...openBookmarkRegion.center,
            placement: 'above' as const,
            label: openBookmarkRegion.name,
            onClick: () => undefined,
            card: {
              title: openBookmarkRegion.name,
              bookmark: {
                isOn: bookmarkStore.isBookmarked(openBookmarkRegion.id),
                onToggle: () => {
                  bookmarkStore.toggle(openBookmarkRegion.id);
                  setOpenBookmarkCode(null);
                },
              },
              rows: [],
            },
          },
    bookmarkControl: {
      count: bookmarkStore.codes.length,
      isOn: isBookmarkLayerOn && bookmarkStore.codes.length > 0,
      isDisabled: bookmarkStore.codes.length === 0,
      onToggle: () => {
        if (bookmarkStore.codes.length === 0) return;
        writeBookmarkLayerOn(!isBookmarkLayerOn);
        setStoredBookmarkLayerOn(!isBookmarkLayerOn);
      },
    },
  } satisfies MapCanvasProps;

  return {
    canvasProps,
    memo,
    /** 겹친 매물 묶음을 눌러 함께 보는 매물. 묶음을 고르지 않았으면 빈 목록이다. */
    groupRecords: records.records.filter((record) => groupIds.includes(record.id)),
    closeGroup: () => setGroupIds([]),
    tapPoint,
    cancelPlacement: () => {
      setTapPoint(null);
      setIsRecommending(false);
      if (pickRequest !== null) endPick();
    },
    /** 매물 상세에서 주소를 바꿀 때 부른다. 지도를 눌러 고른 자리를 `onSave`로 저장하고 끝낸다. */
    startLocationPick: (onSave: (address: MapAddress) => Promise<void>) => {
      setTapPoint(null);
      setPicked(null);
      setHasPickSaveFailed(false);
      setPickRequest({ onSave });
    },
    /** 주소를 바꾸는 중일 때의 안내와 저장, 취소. 아니면 null이다. */
    locationPick:
      pickRequest === null
        ? null
        : {
            status: picked?.status ?? 'idle',
            address: picked?.address ?? null,
            isSaving: isPickSaving,
            hasSaveFailed: hasPickSaveFailed,
            save: () => {
              if (picked?.status !== 'ready' || isPickSaving) return;
              setIsPickSaving(true);
              setHasPickSaveFailed(false);
              pickRequest.onSave(picked.address).then(endPick, () => {
                setIsPickSaving(false);
                setHasPickSaveFailed(true);
              });
            },
            cancel: endPick,
          },
    tapActions,
    /** 동네 추천받기 모드. 추천을 받을 수 없는 화면이면 null이다. */
    recommendMode: onRecommend
      ? {
          isActive: isRecommending,
          toggle: () => {
            setTapPoint(null);
            setIsRecommending((current) => !current);
          },
        }
      : null,
    /** 매물 등록을 눌러 주소를 찾거나 매물을 만드는 중인지. */
    isRegistering,
    suggestRegisterAt,
    /** 현재 위치에서 매물을 추가할지 묻는 중인지. */
    isSuggestingRegister: suggestAt !== null && !isRegistering,
    acceptRegisterSuggestion: () => {
      const point = suggestAt;
      setSuggestAt(null);
      if (point !== null) registerAt(point);
    },
    closeRegisterSuggestion: () => setSuggestAt(null),
    coordinateMenu: (tapPoint === null ? undefined : { ...tapPoint, actions: tapActions }) satisfies
      MapCoordinateMenu | undefined,
    closeTap: () => setTapPoint(null),
    /** 열어 둔 매물·메모·찍은 위치를 모두 닫는다. */
    closeAll: () => {
      closeSelection();
      memo.close();
      setTapPoint(null);
    },
  };
};

export type RecordsMapLayers = ReturnType<typeof useRecordsMapLayers>;

export default useRecordsMapLayers;
