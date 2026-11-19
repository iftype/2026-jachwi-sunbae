import type { MapBounds } from '../model/Map';

type Point = { latitude: number; longitude: number };

/** 정보 카드의 대략 높이(px). 위쪽 가장자리 근처에서 뒤집을지 가늠할 때 쓴다. */
const CARD_ESTIMATED_HEIGHT = 130;
/** 카드 꼬리와 화면 가장자리 사이에 두는 여유(px). */
const CARD_MARGIN = 24;

/** 카드가 화면 위쪽을 넘을 만큼 좌표가 위쪽 가장자리에 가까우면 마커 아래로 뒤집는다. */
export const cardFlipsBelow = (anchor: Point, markerAbove: number, view: MapBounds, containerHeight: number) => {
  const fromTop = ((view.north - anchor.latitude) / (view.north - view.south || 1)) * containerHeight;
  return containerHeight > 0 && fromTop < markerAbove + CARD_ESTIMATED_HEIGHT + CARD_MARGIN;
};
