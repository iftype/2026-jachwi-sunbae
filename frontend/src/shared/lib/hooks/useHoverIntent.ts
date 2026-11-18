import { useCallback, useEffect, useRef, useState } from 'react';

/** 올린 뒤 이만큼 머물러야 뜬다. 마우스를 휙 지나갈 때 번쩍이지 않게 한다. */
export const HOVER_SHOW_DELAY_MS = 200;
/** 벗어난 뒤 이만큼 기다렸다가 닫는다. 가장자리에서 깜빡이거나 카드로 옮겨 가는 사이에 닫히지 않게 한다. */
export const HOVER_HIDE_DELAY_MS = 100;

/** 마우스가 없는 기기(터치)는 올려 둔다는 개념이 없어 지연 없이 바로 반영한다. */
const hasNoHover = () => typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches === true;

type Options = {
  showDelayMs?: number;
  hideDelayMs?: number;
};

/**
 * hover 표시에 의도 확인 지연을 둔다. `enter(target)`로 올리면 `showDelayMs` 뒤에 `target`이 되고,
 * 그 안에 `leave()`로 벗어나면 뜨지 않는다. 벗어나면 `hideDelayMs` 뒤에 닫고, 그 사이 `hold()`(카드 위로 옮겨 감)하면 닫지 않는다.
 * 타이머는 대상이 바뀔 때마다 지우고 언마운트 때도 지운다.
 */
const useHoverIntent = <T>({ showDelayMs = HOVER_SHOW_DELAY_MS, hideDelayMs = HOVER_HIDE_DELAY_MS }: Options = {}) => {
  const [target, setTarget] = useState<T | null>(null);
  const targetRef = useRef<T | null>(null);
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);

  const clearShow = () => {
    if (showTimer.current !== null) window.clearTimeout(showTimer.current);
    showTimer.current = null;
  };
  const clearHide = () => {
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    hideTimer.current = null;
  };
  const commit = (next: T | null) => {
    targetRef.current = next;
    setTarget(next);
  };

  const enter = useCallback(
    (next: T) => {
      clearHide();
      clearShow();
      if (targetRef.current === next) return;
      if (hasNoHover()) {
        commit(next);
        return;
      }
      showTimer.current = window.setTimeout(() => {
        showTimer.current = null;
        commit(next);
      }, showDelayMs);
    },
    [showDelayMs],
  );
  const leave = useCallback(() => {
    clearShow();
    clearHide();
    if (targetRef.current === null) return;
    hideTimer.current = window.setTimeout(() => {
      hideTimer.current = null;
      commit(null);
    }, hideDelayMs);
  }, [hideDelayMs]);
  /** 닫으려던 것을 멈춘다(마우스가 대상에서 뜬 카드로 옮겨 갔을 때). */
  const hold = useCallback(() => clearHide(), []);

  useEffect(
    () => () => {
      clearShow();
      clearHide();
    },
    [],
  );

  return { target, enter, leave, hold };
};

export default useHoverIntent;
