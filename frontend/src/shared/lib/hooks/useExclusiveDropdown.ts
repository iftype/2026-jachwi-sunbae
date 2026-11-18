import { useCallback, useEffect, useSyncExternalStore } from 'react';

/**
 * 한 화면에 검색 드롭다운이 여럿 있어도 한 번에 하나만 열리게 하는 공용 상태.
 * 열린 드롭다운의 id 하나만 모듈 안에 두고, 새로 열면 이전 id가 밀려나 그쪽은 자동으로 닫힌다.
 * 각 드롭다운이 서로를 알 필요가 없어서 드롭다운이 늘어도 규칙이 그대로다.
 */
let activeId: string | null = null;
const listeners = new Set<() => void>();

const setActive = (next: string | null) => {
  if (activeId === next) return;
  activeId = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

const getSnapshot = () => activeId;

/**
 * `id`로 구분하는 드롭다운의 열림 상태. 포커스나 입력 때 `open`, 바깥 클릭과 Esc와 선택 때 `close`를 부른다.
 * 화면에서 사라질 때(언마운트)는 자기가 열고 있었다면 닫아 둔다.
 */
const useExclusiveDropdown = (id: string) => {
  const active = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const open = useCallback(() => setActive(id), [id]);
  const close = useCallback(() => {
    if (activeId === id) setActive(null);
  }, [id]);
  useEffect(
    () => () => {
      if (activeId === id) setActive(null);
    },
    [id],
  );
  return { isOpen: active === id, open, close };
};

export default useExclusiveDropdown;
