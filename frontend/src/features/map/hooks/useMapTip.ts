import { useCallback, useEffect, useMemo, useState } from 'react';

import type { MapTip } from '../model/MapCanvas';

type Options = {
  /** 이미 봤는지를 저장하는 localStorage 키. 지도마다 다르게 쓴다. */
  storageKey: string;
  message: string;
  placement?: 'above' | 'below';
  /** 안내 좌표를 `point`에서 화면 기준 이만큼(px) 옮긴다. 마커와 겹치지 않게 비껴 둘 때 쓴다. 양수 y는 아래쪽이다. */
  offsetPx?: { x: number; y: number };
  /** 지금 확대 단계. `offsetPx`를 좌표 거리로 바꿀 때 쓴다. */
  level?: number;
  /** 안내를 붙일 좌표. 지도가 첫 시점을 잡는 짧은 사이(1.5초)만 따라 바꾸고, 그 뒤로는 잡아 둔다. */
  point: { latitude: number; longitude: number };
  /** false면 안내를 잠시 숨긴다(고른 매물이나 열린 말풍선이 있을 때). 봤음으로 치지는 않는다. */
  enabled?: boolean;
};

const SETTLE_MS = 1500;
/** 네이버 지도 확대 단계(20 - level)에서 화면 1px이 가르키는 경도 크기(도)를 쓰는 기준. */
const NAVER_ZOOM_BASE = 20;

const shiftByPixels = (
  point: { latitude: number; longitude: number },
  offset: { x: number; y: number },
  level: number,
) => {
  const degreesPerPixel = 360 / (256 * 2 ** (NAVER_ZOOM_BASE - level));
  return {
    latitude: point.latitude - offset.y * degreesPerPixel * Math.cos((point.latitude * Math.PI) / 180),
    longitude: point.longitude + offset.x * degreesPerPixel,
  };
};

const hasSeen = (key: string): boolean => {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    // 저장소를 못 쓰면 매번 띄우지 않는다.
    return true;
  }
};

const markSeen = (key: string) => {
  try {
    localStorage.setItem(key, 'true');
  } catch {
    // 저장소를 쓸 수 없으면 이번 화면에서만 닫는다.
  }
};

/**
 * 지도 좌표에 붙는 첫 안내 말풍선을 `MapCanvas`의 `tip`으로 넘길 값으로 만든다.
 * `확인`을 누르거나 지도의 다른 곳을 누르거나 끌면 닫고 봤음으로 저장한다. 좌표가 화면 밖으로 나가면 저장하지 않고 조용히 닫는다.
 */
const useMapTip = ({
  storageKey,
  message,
  placement,
  point,
  offsetPx,
  level,
  enabled = true,
}: Options): MapTip | undefined => {
  const [isOpen, setIsOpen] = useState(() => !hasSeen(storageKey));
  const shifted = offsetPx && level !== undefined ? shiftByPixels(point, offsetPx, level) : point;
  const [anchor, setAnchor] = useState(shifted);
  const [mountedAt] = useState(() => Date.now());
  useEffect(() => {
    // 안내가 숨겨져 있는 동안(아직 붙일 자리가 없을 때)과 처음 1.5초는 좌표를 따라가고, 보이기 시작한 뒤에는 잡아 둔다.
    if (enabled && Date.now() - mountedAt > SETTLE_MS) return;
    setAnchor((current) =>
      current.latitude === shifted.latitude && current.longitude === shifted.longitude ? current : shifted,
    );
  }, [mountedAt, enabled, shifted.latitude, shifted.longitude]);
  const confirm = useCallback(() => {
    markSeen(storageKey);
    setIsOpen(false);
  }, [storageKey]);
  const hide = useCallback(() => setIsOpen(false), []);
  return useMemo(
    () =>
      isOpen && enabled
        ? { ...anchor, message, placement, onConfirm: confirm, onInteract: confirm, onOutOfView: hide }
        : undefined,
    [isOpen, enabled, anchor, message, placement, confirm, hide],
  );
};

export default useMapTip;
