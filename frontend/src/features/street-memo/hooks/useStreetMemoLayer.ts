import { useMemo, useState } from 'react';

import type { MapBounds, MapMarker } from '@/features/map/model/Map';

import { useStreetMemoMutations, useStreetMemos } from '../api/useStreetMemos';
import type { StreetMemo, StreetMemoPreference } from '../model/StreetMemo';

export const STREET_MEMO_MARKER_PREFIX = 'street-memo:';
const DRAFT_MARKER_ID = 'street-memo-draft';
const LABEL_MAX_LENGTH = 20;

type Point = { latitude: number; longitude: number };

const markerLabel = (memo: StreetMemo) =>
  memo.memo.length > LABEL_MAX_LENGTH ? `${memo.memo.slice(0, LABEL_MAX_LENGTH)}…` : memo.memo;

/**
 * 지도 위 거리 메모 한 겹. 인프라 지도와 동네 찾기 지도가 함께 쓴다.
 * 켜져 있으면 화면 안 메모를 마커로 올리고, 메모 하나를 보거나(view) 찍은 위치에 새로 쓰는(compose) 상태를 가진다.
 * 화면 모양(데스크탑 칸·휴대폰 시트)은 지도 화면이 고르고, 이 Hook은 무엇을 보여줄지만 정한다.
 */
const useStreetMemoLayer = (enabled: boolean, bounds: MapBounds | null) => {
  const { memos, isFailed } = useStreetMemos(enabled ? bounds : null);
  const { create, remove } = useStreetMemoMutations();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draftPoint, setDraftPoint] = useState<Point | null>(null);
  // 방금 쓴 메모는 메모 겹이 꺼져 있거나 다시 조회하기 전이어도 바로 열어 보여준다.
  const [created, setCreated] = useState<StreetMemo | null>(null);

  const memoMarkers = useMemo<MapMarker[]>(
    () =>
      enabled
        ? memos.map((memo) => ({
            id: `${STREET_MEMO_MARKER_PREFIX}${memo.id}`,
            latitude: memo.latitude,
            longitude: memo.longitude,
            label: markerLabel(memo),
            tone: 'place' as const,
            category: 'MEMO' as const,
            variant: memo.preference === 'LIKE' ? ('positive' as const) : ('negative' as const),
            actionable: true,
          }))
        : [],
    [enabled, memos],
  );
  const markers = useMemo<MapMarker[]>(
    () =>
      draftPoint
        ? [...memoMarkers, { ...draftPoint, id: DRAFT_MARKER_ID, label: '메모 위치', tone: 'destination' as const }]
        : memoMarkers,
    [memoMarkers, draftPoint],
  );
  const selectedMemo =
    selectedId === null
      ? null
      : (memos.find((memo) => memo.id === selectedId) ?? (created?.id === selectedId ? created : null));

  const close = () => {
    setSelectedId(null);
    setDraftPoint(null);
    create.reset();
    remove.reset();
  };

  return {
    markers,
    isFailed: enabled && isFailed,
    /** compose: 찍은 위치에 새로 쓰는 중, view: 지도에서 고른 메모를 보는 중. */
    mode: draftPoint ? ('compose' as const) : selectedMemo ? ('view' as const) : null,
    selectedMemo,
    selectedMarkerId: selectedMemo ? `${STREET_MEMO_MARKER_PREFIX}${selectedMemo.id}` : null,
    isSubmitting: create.isPending,
    submitFailed: create.isError,
    isRemoving: remove.isPending,
    removeFailed: remove.isError,
    /** 메모 마커면 열고 true를 돌려준다. 다른 마커는 지도 화면이 처리하게 false를 돌려준다. */
    selectMarker: (marker: MapMarker): boolean => {
      if (!marker.id.startsWith(STREET_MEMO_MARKER_PREFIX)) return false;
      create.reset();
      remove.reset();
      setDraftPoint(null);
      setSelectedId(Number(marker.id.slice(STREET_MEMO_MARKER_PREFIX.length)));
      return true;
    },
    startDraft: (point: Point) => {
      create.reset();
      setSelectedId(null);
      setDraftPoint(point);
    },
    submit: (memo: string, preference: StreetMemoPreference, onCreated?: (memo: StreetMemo) => void) => {
      if (draftPoint === null) return;
      create.mutate(
        { ...draftPoint, memo, preference },
        {
          onSuccess: (saved) => {
            setCreated(saved);
            setDraftPoint(null);
            setSelectedId(saved.id);
            onCreated?.(saved);
          },
        },
      );
    },
    remove: () => {
      if (selectedMemo === null) return;
      remove.mutate(selectedMemo.id, { onSuccess: close });
    },
    close,
  };
};

export type StreetMemoLayer = ReturnType<typeof useStreetMemoLayer>;

export default useStreetMemoLayer;
