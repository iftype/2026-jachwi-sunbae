import { DESIGN_RECORDS_PATH, isDesignShell } from '@/shared/lib/navigation/designShell';

export type PropertyReturnPath = '/map' | '/properties' | '/design-preview' | '/design-preview/records';

/** 상세 직접 진입은 목록(시안 셸에서는 시안 기록 화면)으로, 지도 카드에서 진입한 경우에는 지도로 돌아간다. */
export const getPropertyReturnPath = (state: unknown): PropertyReturnPath => {
  const fallback = isDesignShell() ? DESIGN_RECORDS_PATH : '/properties';
  if (typeof state !== 'object' || state === null || !('returnTo' in state)) return fallback;
  if (state.returnTo === '/map' || state.returnTo === '/design-preview' || state.returnTo === '/design-preview/records')
    return state.returnTo;
  return fallback;
};

export const getPropertyReturnState = (state: unknown): unknown =>
  typeof state === 'object' && state !== null && 'returnState' in state ? state.returnState : undefined;
