import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { DEFAULT_MAP_CENTER } from '@/features/map/lib/mapLocation';
import type { MapMarker } from '@/features/map/model/Map';
import { usePropertyList } from '@/features/property/api/useProperties';

import { recordPresentation } from '../model/recordPresentation';

type RecordsLocationState = { focusHeading?: boolean } | null;

/** 화면 밖(주소 등)에서 정하는 선택 매물. 넘기지 않으면 화면 안 상태로 고른다. */
type RecordsSelection = { selectedId: string | null; setSelectedId: (id: string | null) => void };

/**
 * 본 방 기록 화면의 데이터·동네 필터·선택·지도 위치. 데스크탑·휴대폰 화면이 함께 쓴다.
 * 데스크탑은 고른 매물을 주소(`/properties/:propertyId`)로 정하므로 `selection`을 넘긴다.
 */
const useRecords = (selection?: RecordsSelection) => {
  const location = useLocation();
  const locationState = location.state as RecordsLocationState;
  const headingRef = useRef<HTMLHeadingElement>(null);
  // 상세에서 매물을 삭제하고 돌아오면 화면 제목으로 포커스를 옮긴다.
  const shouldFocusHeading = locationState?.focusHeading === true;
  useEffect(() => {
    if (shouldFocusHeading) headingRef.current?.focus();
  }, [shouldFocusHeading]);

  const properties = usePropertyList();
  const allRecords = useMemo(
    () => properties.data?.pages.flatMap((page) => page.content).map(recordPresentation) ?? [],
    [properties.data],
  );
  const districts = ['전체', ...new Set(allRecords.map((record) => record.district))];
  const [district, setDistrict] = useState('전체');
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
  const selectedId = selection ? selection.selectedId : localSelectedId;
  const setSelectedId = selection ? selection.setSelectedId : setLocalSelectedId;
  const [center, setCenter] = useState(DEFAULT_MAP_CENTER);
  const [level, setLevel] = useState(8);
  const [notice, setNotice] = useState('');
  const records = useMemo(
    () => allRecords.filter((record) => district === '전체' || record.district === district),
    [allRecords, district],
  );
  const selected = records.find((record) => record.id === selectedId);

  useEffect(() => {
    const first = allRecords.find((record) => record.latitude !== null && record.longitude !== null);
    if (first && first.latitude !== null && first.longitude !== null)
      setCenter({ latitude: first.latitude, longitude: first.longitude });
  }, [allRecords]);

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
                summary: { amount: record.price },
                tone: 'property',
                actionable: true,
              },
            ]
          : [],
      ),
    [records],
  );

  const selectDistrict = (next: string) => {
    setDistrict(next);
    const first = allRecords.find(
      (record) =>
        (next === '전체' || record.district === next) && record.latitude !== null && record.longitude !== null,
    );
    setSelectedId(null);
    if (first && first.latitude !== null && first.longitude !== null)
      setCenter({ latitude: first.latitude, longitude: first.longitude });
    setLevel(next === '전체' ? 8 : 5);
  };

  /** 지금 동네의 첫 기록 위치로 지도를 옮긴다. */
  const recenter = () => {
    const first = records.find((record) => record.latitude !== null && record.longitude !== null);
    if (first && first.latitude !== null && first.longitude !== null)
      setCenter({ latitude: first.latitude, longitude: first.longitude });
  };

  return {
    headingRef,
    properties,
    districts,
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
    recenter,
    notice,
    setNotice,
  };
};

export type RecordsState = ReturnType<typeof useRecords>;

export default useRecords;
