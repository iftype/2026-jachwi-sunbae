import type { MouseEvent, PointerEvent } from 'react';
import { useRef } from 'react';

/** 손을 뗄 때의 속도(px/ms)에 곱해 얼마나 더 미끄러질지 정한다. */
const GLIDE_MS = 180;

/** 놓은 위치에서 속도만큼 더 간 지점과 가장 가까운 카드 시작점으로 부드럽게 옮긴다. */
const glideToNearestCard = (rail: HTMLDivElement, velocity: number) => {
  if (typeof rail.scrollTo !== 'function') return;
  const railLeft = rail.getBoundingClientRect().left;
  const padding = Number.parseFloat(getComputedStyle(rail).scrollPaddingLeft) || 0;
  const projected = rail.scrollLeft - velocity * GLIDE_MS;
  const starts = Array.from(
    rail.children,
    (card) => card.getBoundingClientRect().left - railLeft + rail.scrollLeft - padding,
  );
  if (starts.length === 0) return;
  const target = starts.reduce((nearest, start) =>
    Math.abs(start - projected) < Math.abs(nearest - projected) ? start : nearest,
  );
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  rail.scrollTo({ left: target, behavior: reduceMotion ? 'auto' : 'smooth' });
};

const useHorizontalDrag = () => {
  const gesture = useRef<{
    pointerId: number;
    startX: number;
    scrollLeft: number;
    dragged: boolean;
    lastX: number;
    lastTime: number;
    velocity: number;
  } | null>(null);
  const suppressClick = useRef(false);

  const finish = (event: PointerEvent<HTMLDivElement>) => {
    if (gesture.current?.pointerId !== event.pointerId) return;
    const { dragged, velocity } = gesture.current;
    suppressClick.current = dragged;
    gesture.current = null;
    delete event.currentTarget.dataset.dragging;
    if (dragged && event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (dragged) glideToNearestCard(event.currentTarget, velocity);
  };

  return {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      suppressClick.current = false;
      gesture.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        scrollLeft: event.currentTarget.scrollLeft,
        dragged: false,
        lastX: event.clientX,
        lastTime: event.timeStamp,
        velocity: 0,
      };
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      const current = gesture.current;
      if (!current || current.pointerId !== event.pointerId) return;
      const distance = event.clientX - current.startX;
      if (!current.dragged && Math.abs(distance) < 6) return;
      if (!current.dragged) {
        current.dragged = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.dataset.dragging = 'true';
      }
      event.preventDefault();
      event.currentTarget.scrollLeft = current.scrollLeft - distance;
      const elapsed = event.timeStamp - current.lastTime;
      if (elapsed > 0) current.velocity = (event.clientX - current.lastX) / elapsed;
      current.lastX = event.clientX;
      current.lastTime = event.timeStamp;
    },
    onPointerUp: finish,
    onPointerCancel: finish,
    onPointerLeave: () => {
      if (gesture.current && !gesture.current.dragged) gesture.current = null;
    },
    onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => {
      if (gesture.current?.pointerId === event.pointerId) {
        suppressClick.current = gesture.current.dragged;
        gesture.current = null;
      }
      delete event.currentTarget.dataset.dragging;
    },
    onClickCapture: (event: MouseEvent<HTMLDivElement>) => {
      if (!suppressClick.current || event.detail === 0) return;
      suppressClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    },
  };
};

export default useHorizontalDrag;
