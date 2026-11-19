import type { MapBounds } from '../model/Map';

type Point = { latitude: number; longitude: number };

/** 정보 카드의 대략 높이(px). 위쪽 가장자리 근처에서 뒤집을지, 두 카드가 겹치는지 가늠할 때 쓴다. */
export const CARD_ESTIMATED_HEIGHT = 130;
/** 정보 카드의 대략 너비(px). 두 카드가 가로로 겹치는지 가늠할 때 쓴다. */
export const CARD_ESTIMATED_WIDTH = 220;
/** 카드 꼬리와 화면 가장자리 사이에 두는 여유(px). */
const CARD_MARGIN = 24;

/** 카드가 화면 위쪽을 넘을 만큼 좌표가 위쪽 가장자리에 가까우면 마커 아래로 뒤집는다. */
export const cardFlipsBelow = (anchor: Point, markerAbove: number, view: MapBounds, containerHeight: number) => {
  const fromTop = ((view.north - anchor.latitude) / (view.north - view.south || 1)) * containerHeight;
  return containerHeight > 0 && fromTop < markerAbove + CARD_ESTIMATED_HEIGHT + CARD_MARGIN;
};

/**
 * 고정 카드와 호버 카드의 앵커가 화면에서 카드 크기보다 가까우면 둘이 겹친다.
 * 겹치면 호버 카드를 고정 카드의 반대쪽(위아래)으로 보낸다. 겹치지 않으면 undefined(기본 방향).
 */
export const hoverCardFlipBelow = (
  hover: Point,
  pinned: Point,
  pinnedFlipsBelow: boolean,
  view: MapBounds,
  size: { width: number; height: number },
) => {
  if (size.width === 0 || size.height === 0) return undefined;
  const dx = ((hover.longitude - pinned.longitude) / (view.east - view.west || 1)) * size.width;
  const dy = ((pinned.latitude - hover.latitude) / (view.north - view.south || 1)) * size.height;
  const overlaps = Math.abs(dx) < CARD_ESTIMATED_WIDTH && Math.abs(dy) < CARD_ESTIMATED_HEIGHT + CARD_MARGIN;
  return overlaps ? !pinnedFlipsBelow : undefined;
};
