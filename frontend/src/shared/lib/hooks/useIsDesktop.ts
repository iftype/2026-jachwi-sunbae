import useMediaQuery from './useMediaQuery';

/**
 * 데스크탑 화면 기준(1024px 이상). 화면별 데스크탑·휴대폰 컴포넌트는 페이지 맨 위에서 이 값으로 한 번만 고른다.
 * CSS에서 같은 기준을 쓸 때도 `(min-width: 1024px)`로 맞춘다.
 */
export const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)';

const useIsDesktop = () => useMediaQuery(DESKTOP_MEDIA_QUERY);

export default useIsDesktop;
