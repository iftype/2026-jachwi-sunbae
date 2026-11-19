import { useSyncExternalStore } from 'react';

/**
 * 휴대폰 지도의 선택한 매물 시트를 접어 둔 선호. 내 기록 지도와 동네 찾기 지도가 같은 값을 쓰고, 이번 방문(세션) 동안만 기억한다.
 * 접힌 채 다른 마커를 눌러도, 선택을 풀었다 다시 골라도 접힌 채 열린다. 데스크탑 패널의 접힘(`detailCollapse`)과는 따로 둔다.
 */
let collapsed = false;
const listeners = new Set<() => void>();

const subscribe = (notify: () => void) => {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
};

export const setSheetCollapsed = (next: boolean) => {
  if (collapsed === next) return;
  collapsed = next;
  listeners.forEach((notify) => notify());
};

export const useSheetCollapsed = () =>
  useSyncExternalStore(
    subscribe,
    () => collapsed,
    () => false,
  );
