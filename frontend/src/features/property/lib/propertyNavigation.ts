import { HOME_PATH, RECORDS_PATH } from '@/shared/lib/navigation/appPaths';

export type PropertyReturnPath = '/map' | typeof HOME_PATH | typeof RECORDS_PATH;

/**
 * 홈·지도에서 진입한 경우에는 진입한 화면으로 돌아간다.
 * 직접 진입은 `fallback`(기본: 기록 화면)으로 돌아간다. 지도 주소(`/map/:propertyId`)로 연 상세는 지도로 돌아간다.
 */
export const getPropertyReturnPath = (
  state: unknown,
  fallback: PropertyReturnPath = RECORDS_PATH,
): PropertyReturnPath => {
  if (typeof state !== 'object' || state === null || !('returnTo' in state)) return fallback;
  if (state.returnTo === '/map' || state.returnTo === HOME_PATH || state.returnTo === RECORDS_PATH)
    return state.returnTo;
  return fallback;
};

/** 들어온 화면이 상태로 넘어왔으면 바로 이전 기록이 그 화면이다. */
export const hasPropertyReturnPath = (state: unknown): boolean =>
  typeof state === 'object' && state !== null && 'returnTo' in state;

export const getPropertyReturnState = (state: unknown): unknown =>
  typeof state === 'object' && state !== null && 'returnState' in state ? state.returnState : undefined;
