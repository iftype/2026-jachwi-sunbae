export type PropertyReturnPath = '/map' | '/properties';

/** 상세 직접 진입은 목록으로, 지도 카드에서 진입한 경우에는 지도로 돌아간다. */
export const getPropertyReturnPath = (state: unknown): PropertyReturnPath =>
  typeof state === 'object' && state !== null && 'returnTo' in state && state.returnTo === '/map'
    ? '/map'
    : '/properties';

export const getPropertyReturnState = (state: unknown): unknown =>
  typeof state === 'object' && state !== null && 'returnState' in state ? state.returnState : undefined;
