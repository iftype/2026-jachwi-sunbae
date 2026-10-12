import { useEffect, useState } from 'react';

const MOBILE_VIEWPORT_QUERY = '(max-width: 430px)';

const readIsMobileViewport = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(MOBILE_VIEWPORT_QUERY).matches
    : false;

/** 모바일 레이아웃과 키보드 입력 흐름을 구분하기 위한 뷰포트 상태다. */
const useIsMobileViewport = () => {
  const [isMobileViewport, setIsMobileViewport] = useState(readIsMobileViewport);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;

    const mediaQuery = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const update = () => setIsMobileViewport(mediaQuery.matches);
    update();
    mediaQuery.addEventListener?.('change', update);
    return () => mediaQuery.removeEventListener?.('change', update);
  }, []);

  return isMobileViewport;
};

export default useIsMobileViewport;
