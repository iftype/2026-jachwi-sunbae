import { HOME_PATH, NEIGHBORHOODS_PATH, RECORDS_PATH } from '@/shared/lib/navigation/appPaths';

export type PropertyReturnPath = typeof HOME_PATH | typeof RECORDS_PATH | typeof NEIGHBORHOODS_PATH;

/**
 * 홈, 기록, 동네 찾기 화면에서 진입한 경우에는 진입한 화면으로 돌아간다. 직접 진입은 `fallback`(기본: 기록 화면)으로 돌아간다.
 * 인프라 지도는 기록 화면으로 합쳐서, 예전 상태(`returnTo: '/map'`)로 돌아오면 기록 화면으로 간다.
 */
export const getPropertyReturnPath = (
  state: unknown,
  fallback: PropertyReturnPath = RECORDS_PATH,
): PropertyReturnPath => {
  if (typeof state !== 'object' || state === null || !('returnTo' in state)) return fallback;
  if (state.returnTo === HOME_PATH || state.returnTo === RECORDS_PATH || state.returnTo === NEIGHBORHOODS_PATH)
    return state.returnTo;
  return fallback;
};

/**
 * 매물 상세에서 사진 관리로 넘어갈 때 넘기는 상태. 사진 화면의 뒤로가기는 이 상태가 있으면 새로 이동하지 않고 이전 기록(상세)으로 돌아간다.
 * 그래야 상세가 들어온 곳(본 방 기록 등)을 기억한 채로 돌아오고, 휴대폰 뒤로가기도 사진 화면으로 되돌아가지 않는다.
 */
export const FROM_PROPERTY_DETAIL_STATE = { fromPropertyDetail: true } as const;

export const cameFromPropertyDetail = (state: unknown): boolean =>
  typeof state === 'object' && state !== null && 'fromPropertyDetail' in state && state.fromPropertyDetail === true;

/** 들어온 화면이 상태로 넘어왔으면 바로 이전 기록이 그 화면이다. */
export const hasPropertyReturnPath = (state: unknown): boolean =>
  typeof state === 'object' && state !== null && 'returnTo' in state;

export const getPropertyReturnState = (state: unknown): unknown =>
  typeof state === 'object' && state !== null && 'returnState' in state ? state.returnState : undefined;

/** 상세 머리와 오류 화면의 돌아가기 문구. 들어온 화면 이름을 적는다. */
export const propertyBackLabel = (backTo: string): string =>
  backTo === NEIGHBORHOODS_PATH
    ? '동네 찾기로 돌아가기'
    : backTo === RECORDS_PATH
      ? '기록 화면으로 돌아가기'
      : '홈으로 돌아가기';
