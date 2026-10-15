import type { MouseEvent, PointerEvent } from 'react';
import { useRef } from 'react';

const useHorizontalDrag = () => {
  const gesture = useRef<{ pointerId: number; startX: number; scrollLeft: number; dragged: boolean } | null>(null);
  const suppressClick = useRef(false);

  const finish = (event: PointerEvent<HTMLDivElement>) => {
    if (gesture.current?.pointerId !== event.pointerId) return;
    const dragged = gesture.current.dragged;
    suppressClick.current = dragged;
    gesture.current = null;
    delete event.currentTarget.dataset.dragging;
    if (dragged && event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
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
