import { authenticationQueryKey, queryClient } from '@/shared/api/queryClient';

export type AuthenticationSession = {
  accessToken: string;
  tokenType: string;
  expiresAt: number;
  memberId: number | null;
};

/** 인증을 이어갈 수 없게 된 까닭. `unauthorized`는 서버가 Refresh 쿠키로도 회원을 복원하지 못한 경우다. */
export type AuthenticationTerminationReason = 'unauthorized' | null;

type AuthenticationState = {
  session: AuthenticationSession | null;
  terminationReason: AuthenticationTerminationReason;
};

type AuthenticationInput = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  memberId?: number | null;
};

const listeners = new Set<() => void>();
// 회원이 바뀌거나 인증이 끝날 때만 올린다. 같은 회원의 토큰 갱신은 진행 중인 요청을 버리지 않는다.
let authenticationRevision = 0;

// Access Token은 메모리에만 둔다. 새로고침하면 사라지고, Refresh 쿠키로 같은 회원을 다시 받는다.
let state: AuthenticationState = { session: null, terminationReason: null };

const emitChange = () => {
  listeners.forEach((listener) => listener());
};

const clearAuthenticationClientState = () => {
  void queryClient.cancelQueries({ queryKey: authenticationQueryKey });
  queryClient.removeQueries({ queryKey: authenticationQueryKey });
  queryClient.getMutationCache().clear();
};

export const calculateExpiresAt = (expiresIn: number, now = Date.now()): number => {
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    return now;
  }

  return now + expiresIn * 1_000;
};

export const clearAuthentication = (reason: AuthenticationTerminationReason) => {
  authenticationRevision += 1;
  state = { session: null, terminationReason: reason };
  clearAuthenticationClientState();
  emitChange();
};

/**
 * 로그인 응답으로 세션을 정한다. 첫 로그인과 같은 회원의 토큰 갱신이면 화면 캐시를 그대로 두고,
 * 다른 회원으로 바뀌면 이전 회원의 캐시를 지운다.
 */
export const setAuthentication = ({
  accessToken,
  tokenType,
  expiresIn,
  memberId = null,
}: AuthenticationInput): AuthenticationSession => {
  const previous = state.session;
  if (previous !== null && previous.memberId !== memberId) {
    authenticationRevision += 1;
    clearAuthenticationClientState();
  }

  const session = { accessToken, tokenType, expiresAt: calculateExpiresAt(expiresIn), memberId };
  state = { session, terminationReason: null };
  emitChange();
  return session;
};

/** 만료된 토큰은 돌려주지 않는다. 호출한 쪽이 로그인을 다시 불러 새 토큰을 받는다. */
export const getAccessToken = (): string | null => {
  const { session } = state;
  if (session === null || session.expiresAt <= Date.now()) return null;
  return session.accessToken;
};

export const getAuthenticationRevision = (): number => authenticationRevision;

export const getAuthenticationSnapshot = (): AuthenticationState => state;

export const subscribeAuthentication = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const resetAuthenticationForTests = () => {
  authenticationRevision += 1;
  state = { session: null, terminationReason: null };
  queryClient.clear();
  emitChange();
};
