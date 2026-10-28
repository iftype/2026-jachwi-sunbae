import { useEffect, useMemo, useState } from 'react';

import type { MapBounds, MapMarker } from '@/features/map/model/Map';

import { useStreetMemoMutations, useStreetMemos } from '../api/useStreetMemos';
import type { StreetMemo, StreetMemoPreference } from '../model/StreetMemo';

export const STREET_MEMO_MARKER_PREFIX = 'street-memo:';
const DRAFT_MARKER_ID = 'street-memo-draft';
const FLASH_MARKER_ID = 'street-memo-flash';
/** 방금 남긴 메모 글을 지도에 띄워 두는 시간. 말풍선 애니메이션(2.4초)과 맞춘다. */
const FLASH_DURATION_MS = 2400;
const LABEL_MAX_LENGTH = 20;

type Point = { latitude: number; longitude: number };

const markerLabel = (memo: StreetMemo) =>
  memo.memo.length > LABEL_MAX_LENGTH ? `${memo.memo.slice(0, LABEL_MAX_LENGTH)}…` : memo.memo;

/**
 * 지도 위 거리 메모 한 겹. 인프라 지도와 동네 찾기 지도가 함께 쓴다.
 * 켜져 있으면 화면 안 메모를 마커로 올리고, 메모 하나를 보거나(view) 찍은 위치에 새로 쓰는(compose) 상태를 가진다.
 * 메모를 남기면 상세를 열지 않고 그 자리에 쓴 글을 잠깐 띄운다(flash).
 * 화면 모양(데스크탑 칸·휴대폰 시트)은 지도 화면이 고르고, 이 Hook은 무엇을 보여줄지만 정한다.
 */
const useStreetMemoLayer = (enabled: boolean, bounds: MapBounds | null) => {
  const { memos, isFailed } = useStreetMemos(enabled ? bounds : null);
  const { create, remove } = useStreetMemoMutations();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draftPoint, setDraftPoint] = useState<Point | null>(null);
  // 방금 남긴 메모는 상세를 열지 않고, 그 자리에 글을 잠깐 띄웠다가 지운다.
  const [flash, setFlash] = useState<StreetMemo | null>(null);
  useEffect(() => {
    if (flash === null) return;
    const timer = window.setTimeout(() => setFlash(null), FLASH_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [flash]);

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
    () => [
      ...memoMarkers,
      ...(draftPoint ? [{ ...draftPoint, id: DRAFT_MARKER_ID, label: '메모 위치', tone: 'destination' as const }] : []),
      ...(flash
        ? [
            {
              id: `${FLASH_MARKER_ID}-${flash.id}`,
              latitude: flash.latitude,
              longitude: flash.longitude,
              label: flash.memo,
              tone: 'flash' as const,
            },
          ]
        : []),
    ],
    [memoMarkers, draftPoint, flash],
  );
  const selectedMemo = selectedId === null ? null : (memos.find((memo) => memo.id === selectedId) ?? null);

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
            setDraftPoint(null);
            setFlash(saved);
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
