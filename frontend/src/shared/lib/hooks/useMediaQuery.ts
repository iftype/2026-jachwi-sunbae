import { useSyncExternalStore } from 'react';

/** 미디어 쿼리 일치 여부를 구독한다. 화면 크기에 따라 그릴 요소 자체가 달라질 때만 쓴다. */
const useMediaQuery = (query: string) =>
  useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia?.(query);
      media?.addEventListener('change', onChange);
      return () => media?.removeEventListener('change', onChange);
    },
    () => window.matchMedia?.(query).matches === true,
    () => false,
  );

export default useMediaQuery;
