import { useSyncExternalStore } from 'react';

/** 데스크탑 상세 패널을 접어 두었는지. 내 기록 상세와 동네 찾기 매물 패널이 같은 값을 쓰고, 새로고침해도 이 기기에서 유지한다. */
const STORAGE_KEY = 'jachwi.detail-panel-collapsed';
const CHANGE_EVENT = 'jachwi-detail-panel-collapsed-changed';
// 저장소를 쓸 수 없을 때(사생활 보호 모드 등) 이번 화면에서만 기억하는 값.
let memory = false;

export const isDetailCollapsed = (): boolean => {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return memory;
  }
};

const subscribe = (notify: () => void) => {
  window.addEventListener(CHANGE_EVENT, notify);
  window.addEventListener('storage', notify);
  return () => {
    window.removeEventListener(CHANGE_EVENT, notify);
    window.removeEventListener('storage', notify);
  };
};

export const setDetailCollapsed = (collapsed: boolean) => {
  memory = collapsed;
  try {
    if (collapsed) localStorage.setItem(STORAGE_KEY, 'true');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 저장소를 쓸 수 없으면 `memory`만 바뀐다.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
};

export const useDetailCollapsed = () => useSyncExternalStore(subscribe, isDetailCollapsed, () => false);
