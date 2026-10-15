import type { PointerEvent } from 'react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import type { MapPropertySheetStage } from '../model/MapSheet';

const SHEET_DRAG_THRESHOLD = 20;

const sheetBottomInset = (sheet: HTMLElement | null): number => {
  if (sheet === null) return 0;
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return Math.max((Number.parseFloat(getComputedStyle(sheet).paddingBottom) || 0) - 0.5 * rem, 0);
};

const setSheetContentHeight = (sheet: HTMLElement, visibleHeight: number, preserveContent = false): void => {
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const headerHeight = sheet.firstElementChild?.getBoundingClientRect().height || 2.25 * rem;
  const nextHeight = Math.max(visibleHeight - sheetBottomInset(sheet) - headerHeight - 0.5 * rem, 0);
  const previousHeight = Number.parseFloat(sheet.style.getPropertyValue('--map-sheet-content-height')) || 0;
  sheet.style.setProperty(
    '--map-sheet-content-height',
    `${preserveContent ? Math.max(previousHeight, nextHeight) : nextHeight}px`,
  );
};

const sheetStageHeights = (sheetRef: React.RefObject<HTMLElement | null>): Record<MapPropertySheetStage, number> => {
  const parent = sheetRef.current?.parentElement;
  const stage = parent?.hasAttribute('data-sheet-viewport') ? parent.parentElement : parent;
  const stageHeight = stage?.getBoundingClientRect().height ?? 0;
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const fullHeight = sheetRef.current?.getBoundingClientRect().height || Math.max(stageHeight - 4.25 * rem, 0);
  const sheet = sheetRef.current;
  const bottomInset = sheetBottomInset(sheet);
  const content = sheet?.querySelector<HTMLElement>('[data-sheet-content]');
  const singleHeight =
    sheet?.dataset.single === 'true' && content !== null && content !== undefined && !content.hidden
      ? content.scrollHeight + (sheet.firstElementChild?.getBoundingClientRect().height || 2.25 * rem) + 0.5 * rem
      : Infinity;
  return {
    closed: Math.min(2.25 * rem + bottomInset, fullHeight),
    mid: Math.min(Math.min(stageHeight * 0.34, 18 * rem, singleHeight) + bottomInset, fullHeight),
    full: fullHeight,
  };
};

const useMapSheet = (isVisible = true, initialStage: MapPropertySheetStage = 'closed') => {
  const [sheetStage, setSheetStage] = useState<MapPropertySheetStage>(initialStage);
  const [isDragging, setIsDragging] = useState(false);
  const sheetRef = useRef<HTMLElement | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const dragStartRef = useRef<{ y: number; height: number } | null>(null);
  const dragHeightsRef = useRef<Record<MapPropertySheetStage, number> | null>(null);
  const pendingClientYRef = useRef<number | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const draggedSheetRef = useRef(false);

  const clearDragStyles = useCallback(() => {
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    pendingClientYRef.current = null;
    sheetRef.current?.style.removeProperty('transition');
    sheetRef.current?.parentElement?.style.removeProperty('--map-sheet-drag-height');
  }, []);

  const syncSheetStageTransform = useCallback((stage: MapPropertySheetStage) => {
    const sheet = sheetRef.current;
    if (sheet === null) return;

    const heights = sheetStageHeights(sheetRef);
    const offset = Math.max(heights.full - heights[stage], 0);
    sheet.style.transform = `translate3d(0, ${offset}px, 0)`;
    // 닫는 동안에는 카드 영역을 유지하고 시트 전체만 아래로 이동한다.
    // 내용 높이까지 동시에 줄이면 카드는 먼저 잘리고 빈 흰 면만 내려온다.
    setSheetContentHeight(sheet, heights[stage], true);
    sheet.parentElement?.style.setProperty(
      '--map-sheet-visible-height',
      `${Math.max(heights[stage] - sheetBottomInset(sheet), 0)}px`,
    );
  }, []);

  useLayoutEffect(() => {
    if (!isVisible) return;
    syncSheetStageTransform(sheetStage);
    const sheet = sheetRef.current;
    const finishClosing = (event: TransitionEvent) => {
      if (event.target !== sheet || event.propertyName !== 'transform' || sheetStage === 'closed') return;
      if (sheet !== null && dragStartRef.current === null) {
        setSheetContentHeight(sheet, sheetStageHeights(sheetRef)[sheetStage]);
      }
    };
    sheet?.addEventListener('transitionend', finishClosing);
    const parent = sheetRef.current?.parentElement;
    const observer =
      parent != null && typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (dragStartRef.current === null) syncSheetStageTransform(sheetStage);
          })
        : null;
    if (parent != null) observer?.observe(parent);
    const content = sheetRef.current?.querySelector<HTMLElement>('[data-sheet-content]');
    if (content != null) observer?.observe(content);
    return () => {
      sheet?.removeEventListener('transitionend', finishClosing);
      observer?.disconnect();
      clearDragStyles();
    };
  }, [isVisible, sheetStage, syncSheetStageTransform, clearDragStyles]);

  const applyDragHeight = useCallback((clientY: number) => {
    const start = dragStartRef.current;
    const heights = dragHeightsRef.current;
    const sheet = sheetRef.current;
    if (start === null || heights === null || sheet === null) return;

    const next = Math.min(Math.max(start.height + (start.y - clientY), heights.closed), heights.full);
    sheet.style.transform = `translate3d(0, ${Math.max(heights.full - next, 0)}px, 0)`;
    setSheetContentHeight(sheet, next, true);
    sheet.parentElement?.style.setProperty(
      '--map-sheet-drag-height',
      `${Math.max(next - sheetBottomInset(sheet), 0)}px`,
    );
  }, []);

  const scheduleDragHeight = useCallback(
    (clientY: number) => {
      pendingClientYRef.current = clientY;
      if (dragFrameRef.current !== null) return;

      dragFrameRef.current = window.requestAnimationFrame(() => {
        dragFrameRef.current = null;
        const pendingClientY = pendingClientYRef.current;
        pendingClientYRef.current = null;
        if (pendingClientY !== null) applyDragHeight(pendingClientY);
      });
    },
    [applyDragHeight],
  );

  const handleDragStart = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const heights = sheetStageHeights(sheetRef);
      dragStartRef.current = { y: event.clientY, height: heights[sheetStage] };
      dragHeightsRef.current = heights;
      touchStartYRef.current = event.clientY;
      sheetRef.current?.style.setProperty('transition', 'none');
      setIsDragging(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [sheetStage],
  );

  const handleDragMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (dragStartRef.current === null) return;
      scheduleDragHeight(event.clientY);
    },
    [scheduleDragHeight],
  );

  const handleDragEnd = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const start = dragStartRef.current;
      const startY = touchStartYRef.current;
      const heights = dragHeightsRef.current;
      applyDragHeight(event.clientY);
      dragStartRef.current = null;
      dragHeightsRef.current = null;
      touchStartYRef.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      clearDragStyles();
      setIsDragging(false);
      if (start === null || startY === null) {
        syncSheetStageTransform(sheetStage);
        return;
      }
      if (Math.abs(event.clientY - startY) <= SHEET_DRAG_THRESHOLD) {
        syncSheetStageTransform(sheetStage);
        return;
      }

      draggedSheetRef.current = true;
      if (heights === null) {
        syncSheetStageTransform(sheetStage);
        return;
      }
      const released = start.height + (start.y - event.clientY);
      const nearest = (Object.entries(heights) as Array<[MapPropertySheetStage, number]>).reduce((best, entry) =>
        Math.abs(entry[1] - released) < Math.abs(best[1] - released) ? entry : best,
      );
      setSheetStage(nearest[0]);
      if (nearest[0] === sheetStage) syncSheetStageTransform(sheetStage);
    },
    [applyDragHeight, clearDragStyles, sheetStage, syncSheetStageTransform],
  );

  const handleDragCancel = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      touchStartYRef.current = null;
      dragStartRef.current = null;
      dragHeightsRef.current = null;
      clearDragStyles();
      setIsDragging(false);
      syncSheetStageTransform(sheetStage);
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    },
    [clearDragStyles, sheetStage, syncSheetStageTransform],
  );

  const toggleSheet = useCallback(() => {
    if (draggedSheetRef.current) {
      draggedSheetRef.current = false;
      return;
    }
    setSheetStage((current) => (current === 'closed' ? 'mid' : 'closed'));
  }, []);

  const expandSheet = useCallback(() => setSheetStage('full'), []);
  const previewSheet = useCallback(() => setSheetStage('mid'), []);
  const closeSheet = useCallback(() => setSheetStage('closed'), []);

  return {
    sheetRef,
    sheetStage,
    isDragging,
    expandSheet,
    previewSheet,
    closeSheet,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    handleDragCancel,
    toggleSheet,
  };
};

export default useMapSheet;
