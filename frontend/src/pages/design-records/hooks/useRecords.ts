import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';

import { type MapCoordinate, MapLocationError, requestCurrentMapLocation } from '@/features/map/lib/mapLocation';
import type { MapMarker } from '@/features/map/model/Map';
import { usePropertyList } from '@/features/property/api/useProperties';
import usePropertyMarkerPhotos from '@/features/property/hooks/usePropertyMarkerPhotos';
import { takeMovedProperty } from '@/features/property/model/movedProperty';
import {
  hiddenPreviewSnapshot,
  parseHiddenPreviewIds,
  subscribeHiddenPreviews,
} from '@/features/property/model/previewPropertyDismissal';
import {
  isPreviewProperty,
  SAMPLE_PROPERTIES_VIEW,
  withPreviewProperties,
} from '@/features/property/model/sampleProperties';
import { PROPERTY_PLACEHOLDER } from '@/shared/assets/propertyImageAssets';

import { recordPresentation } from '../model/recordPresentation';

/** 화면 밖(주소 등)에서 정하는 선택 매물. 넘기지 않으면 화면 안 상태로 고른다. */
type RecordsSelection = {
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  focusCenter?: (point: MapCoordinate, level: number, opensDetail: boolean) => MapCoordinate;
};

/**
 * 본 방 기록 화면의 데이터·동네 필터·선택·지도 위치. 데스크탑·휴대폰 화면이 함께 쓴다.
 * 데스크탑은 고른 매물을 주소(`/properties/:propertyId`)로 정하므로 `selection`을 넘긴다.
 */
const useRecords = (selection?: RecordsSelection) => {
  const location = useLocation();
  const locationState: unknown = location.state;
  const headingRef = useRef<HTMLHeadingElement>(null);
  // 상세에서 매물을 삭제하고 돌아오면 화면 제목으로 포커스를 옮긴다.
  const shouldFocusHeading =
    typeof locationState === 'object' &&
    locationState !== null &&
    'focusHeading' in locationState &&
    locationState.focusHeading === true;
  useEffect(() => {
    if (shouldFocusHeading) headingRef.current?.focus();
  }, [shouldFocusHeading]);

  const properties = usePropertyList();
  const hiddenPreviewValue = useSyncExternalStore(subscribeHiddenPreviews, hiddenPreviewSnapshot);
  const hiddenPreviewIds = useMemo(() => parseHiddenPreviewIds(hiddenPreviewValue), [hiddenPreviewValue]);
  const allRecords = useMemo(
    () =>
      withPreviewProperties(properties.data?.pages.flatMap((page) => page.content) ?? [], properties.isSuccess)
        .properties.filter((property) => !hiddenPreviewIds.includes(property.propertyId))
        .map(recordPresentation),
    [properties.data, properties.isSuccess, hiddenPreviewIds],
  );
  // 주소가 없는 매물도 `주소 미등록` 뱃지로 모아 보여 준다.
  const districts = ['전체', ...new Set(allRecords.map((record) => record.district))];
  /** 뱃지 오른쪽에 두는 동네별 매물 수. */
  const districtCounts = useMemo(() => {
    const counts: Record<string, number> = { 전체: allRecords.length };
    for (const record of allRecords) counts[record.district] = (counts[record.district] ?? 0) + 1;
    return counts;
  }, [allRecords]);
  const [district, setDistrict] = useState('전체');
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
  const selectedId = selection ? selection.selectedId : localSelectedId;
  const setSelectedId = selection ? selection.setSelectedId : setLocalSelectedId;
  // 기록을 받기 전에는 미리보기 매물 자리에서 시작한다. 기록이 오면 아래에서 첫 기록 자리로 한 번 옮긴다.
  const [center, setCenter] = useState<MapCoordinate>(SAMPLE_PROPERTIES_VIEW);
  const [level, setLevel] = useState(SAMPLE_PROPERTIES_VIEW.level);
  const [notice, setNotice] = useState('');
  const focus = (point: MapCoordinate, nextLevel = level, opensDetail = false) =>
    setCenter(selection?.focusCenter?.(point, nextLevel, opensDetail) ?? point);
  // 지도에서 방금 만든 매물. 그 핀은 아래에서 떠오르며 나타나 새로 생긴 자리를 알린다.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const records = useMemo(
    () => allRecords.filter((record) => district === '전체' || record.district === district),
    [allRecords, district],
  );
  const selected = records.find((record) => record.id === selectedId);

  // 상세에서 위치를 바꿔 저장한 매물이 새 좌표로 목록에 들어오면, 그 자리로 지도를 옮기고 매물을 골라 새 핀을 보인다.
  // 처음 그릴 때(휴대폰은 상세에서 돌아오며 새로 그린다)도 첫 기록 대신 그 매물로 간다.
  const hasCentered = useRef(false);
  useEffect(() => {
    const moved = takeMovedProperty((propertyId) => allRecords.find((record) => record.id === String(propertyId)));
    if (moved === null) return;
    const movedId = String(moved.propertyId);
    hasCentered.current = true;
    setDistrict('전체');
    if (selectedId !== movedId) setSelectedId(movedId);
    focus({ latitude: moved.latitude, longitude: moved.longitude }, level, true);
  }, [allRecords, selectedId, setSelectedId]);

  // 기록을 처음 받았을 때만 첫 기록 자리로 지도를 옮긴다. 확대 단계는 그대로 둔다.
  // 매물을 만들거나 지워 목록을 다시 받을 때마다 옮기면 보고 있던 지도가 다른 자리로 튄다.
  useEffect(() => {
    if (hasCentered.current) return;
    const first = allRecords.find((record) => record.latitude !== null && record.longitude !== null);
    if (first === undefined) return;
    hasCentered.current = true;
    // 미리보기 매물은 첫 시점(`SAMPLE_PROPERTIES_VIEW`)이 이미 모두 담고 있다.
    if (!isPreviewProperty(first.id) && first.latitude !== null && first.longitude !== null) {
      focus({ latitude: first.latitude, longitude: first.longitude });
    }
  }, [allRecords]);

  const photoUrls = usePropertyMarkerPhotos(records);
  const markers = useMemo<MapMarker[]>(
    () =>
      records.flatMap((record) =>
        record.latitude !== null && record.longitude !== null
          ? [
              {
                id: record.id,
                latitude: record.latitude,
                longitude: record.longitude,
                label: record.name,
                summary: { amount: record.rent },
                tone: 'property',
                actionable: true,
                appear: record.id === createdId || undefined,
                // 대표 사진이 있으면 그 사진, 없으면 기본 매물 이미지를 네모 마커로 올려 모든 매물 마커를 같은 모양으로 둔다.
                photo: photoUrls.get(record.id) ?? PROPERTY_PLACEHOLDER.src2x,
              },
            ]
          : [],
      ),
    [records, createdId, photoUrls],
  );

  /**
   * 지도에서 방금 만든 매물을 알린다. 동네 필터를 풀고 그 자리로 다가가 매물을 고르며, 핀은 떠오르며 나타난다.
   * 등록 화면이나 상세로 넘어가지 않고 지도에 머물러, 어디에 생겼는지 바로 보게 한다.
   */
  const revealCreated = (propertyId: string, _location: MapCoordinate) => {
    setDistrict('전체');
    setCreatedId(propertyId);
    setSelectedId(propertyId);
  };

  /**
   * 동네 뱃지를 누른다. 다른 뱃지면 그 동네로 옮기고, 이미 고른 뱃지를 다시 누르면 그 동네 매물을
   * 목록 순서대로 하나씩 넘기며 지도를 그 매물로 옮긴다(마지막 다음은 처음으로 돌아간다).
   * `open`이면 다른 뱃지를 눌러도 그 동네 첫 매물을 바로 열어 보인다(휴대폰 시트).
   * 같은 뱃지를 다시 눌러 매물을 넘기는 것은 `open`일 때(휴대폰)만 한다. 데스크탑은 아무 일도 하지 않는다.
   */
  const selectDistrict = (next: string, options?: { open?: boolean }) => {
    if (next === district && options?.open !== true) return;
    if (next === district) {
      const inDistrict = allRecords.filter(
        (record) =>
          (next === '전체' || record.district === next) && record.latitude !== null && record.longitude !== null,
      );
      if (inDistrict.length === 0) return;
      const current = inDistrict.findIndex((record) => record.id === selectedId);
      const target = inDistrict[(current + 1) % inDistrict.length];
      setSelectedId(target.id);
      if (target.latitude !== null && target.longitude !== null)
        focus({ latitude: target.latitude, longitude: target.longitude }, level, true);
      return;
    }
    setDistrict(next);
    const first = allRecords.find(
      (record) =>
        (next === '전체' || record.district === next) && record.latitude !== null && record.longitude !== null,
    );
    const opened = options?.open === true && first !== undefined;
    setSelectedId(opened ? first.id : null);
    if (first && first.latitude !== null && first.longitude !== null)
      focus({ latitude: first.latitude, longitude: first.longitude }, level, opened);
  };

  /**
   * 리스트에서 고른 매물을 열고 지도를 그 매물 핀 자리로 옮긴다. 배율은 그대로 두어 주변을 함께 본다.
   * 위치가 없는 매물은 고르기만 한다.
   */
  // 상세는 지도 위에 얹히므로 열어도 지도를 옮기거나 확대하지 않는다.
  const showRecord = (recordId: string) => {
    setSelectedId(recordId);
  };

  // 주소 검색으로 간 자리. 지도에 단순한 핀으로 남긴다.
  const [searchedPoint, setSearchedPoint] = useState<MapCoordinate | null>(null);
  const searchTo = (coordinate: MapCoordinate) => {
    // 같은 자리를 다시 검색해도 새 객체로 바꾸지 않는다. 바뀌지 않는 값으로 다시 그리기를 부르지 않기 위해서다.
    setSearchedPoint((current) =>
      current?.latitude === coordinate.latitude && current.longitude === coordinate.longitude
        ? current
        : { latitude: coordinate.latitude, longitude: coordinate.longitude },
    );
    focus(coordinate, level);
  };

  /** 주소 검색 결과처럼 고른 자리로 지도를 옮기고 동네 수준으로 확대한다. */
  const moveTo = (coordinate: MapCoordinate) => {
    focus(coordinate, level);
  };

  /**
   * 현재 위치로 지도를 옮긴다. 사파리는 누른 그 순간에만 권한 창을 띄우므로 클릭 처리기에서 바로 부른다.
   * 위치를 못 받으면 까닭을 알림으로 보여 준다. 받은 위치를 더 쓰려면 `onLocated`를 넘긴다.
   */
  const moveToCurrentLocation = (onLocated?: (coordinate: MapCoordinate) => void) => {
    requestCurrentMapLocation().then(
      (coordinate) => {
        moveTo(coordinate);
        onLocated?.(coordinate);
      },
      (error: unknown) =>
        setNotice(
          error instanceof MapLocationError && error.reason === 'denied'
            ? '위치 권한이 꺼져 있어요. 설정에서 켜 주세요.'
            : '현재 위치를 확인하지 못했어요.',
        ),
    );
  };

  return {
    headingRef,
    properties,
    districts,
    districtCounts,
    district,
    setDistrict,
    selectDistrict,
    records,
    selectedId,
    setSelectedId,
    selected,
    center,
    setCenter,
    level,
    setLevel,
    markers,
    moveTo,
    searchedPoint,
    searchTo,
    clearSearchedPoint: () => setSearchedPoint(null),
    moveToCurrentLocation,
    revealCreated,
    showRecord,
    notice,
    setNotice,
  };
};

export type RecordsState = ReturnType<typeof useRecords>;

export default useRecords;
