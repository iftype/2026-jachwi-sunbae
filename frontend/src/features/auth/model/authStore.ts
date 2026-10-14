import { authenticationQueryKey, queryClient } from '@/shared/api/queryClient';

export type AuthenticationSession = {
  accessToken: string;
  tokenType: string;
  expiresAt: number;
};

export type AuthenticationTerminationReason = 'expired' | 'unauthorized' | 'logout' | null;

type AuthenticationState = {
  session: AuthenticationSession | null;
  terminationReason: AuthenticationTerminationReason;
};

type AuthenticationInput = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
};

const listeners = new Set<() => void>();
const AUTHENTICATION_STORAGE_KEY = 'jachwi-sunbae.authentication.session';
let expirationTimer: ReturnType<typeof setTimeout> | null = null;
let authenticationRevision = 0;
const readStoredSession = (): AuthenticationSession | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(AUTHENTICATION_STORAGE_KEY);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    if (
      typeof value !== 'object' ||
      value === null ||
      !('accessToken' in value) ||
      !('tokenType' in value) ||
      !('expiresAt' in value) ||
      typeof value.accessToken !== 'string' ||
      value.tokenType !== 'Bearer' ||
      typeof value.expiresAt !== 'number' ||
      value.expiresAt <= Date.now()
    ) {
      window.localStorage.removeItem(AUTHENTICATION_STORAGE_KEY);
      return null;
    }
    return { accessToken: value.accessToken, tokenType: value.tokenType, expiresAt: value.expiresAt };
  } catch {
    window.localStorage.removeItem(AUTHENTICATION_STORAGE_KEY);
    return null;
  }
};

let state: AuthenticationState = {
  session: readStoredSession(),
  terminationReason: null,
};

const emitChange = () => {
  listeners.forEach((listener) => listener());
};

const clearExpirationTimer = () => {
  if (expirationTimer !== null) {
    clearTimeout(expirationTimer);
    expirationTimer = null;
  }
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
  clearExpirationTimer();
  authenticationRevision += 1;
  state = { session: null, terminationReason: reason };
  if (typeof window !== 'undefined') window.localStorage.removeItem(AUTHENTICATION_STORAGE_KEY);
  clearAuthenticationClientState();
  emitChange();
};

export const setAuthentication = ({
  accessToken,
  tokenType,
  expiresIn,
}: AuthenticationInput): AuthenticationSession => {
  clearExpirationTimer();
  authenticationRevision += 1;
  clearAuthenticationClientState();

  const session = {
    accessToken,
    tokenType,
    expiresAt: calculateExpiresAt(expiresIn),
  };

  state = { session, terminationReason: null };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(AUTHENTICATION_STORAGE_KEY, JSON.stringify(session));
  }

  const remainingMilliseconds = session.expiresAt - Date.now();

  if (remainingMilliseconds <= 0) {
    clearAuthentication('expired');
    return session;
  }

  expirationTimer = setTimeout(() => {
    clearAuthentication('expired');
  }, remainingMilliseconds);

  emitChange();
  return session;
};

export const getAccessToken = (): string | null => {
  const { session } = state;

  if (session === null) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    clearAuthentication('expired');
    return null;
  }

  return session.accessToken;
};

export const getAuthenticationRevision = (): number => authenticationRevision;

export const getAuthenticationSnapshot = (): AuthenticationState => state;

export const subscribeAuthentication = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const resetAuthenticationForTests = () => {
  clearExpirationTimer();
  authenticationRevision += 1;
  state = { session: null, terminationReason: null };
  if (typeof window !== 'undefined') window.localStorage.removeItem(AUTHENTICATION_STORAGE_KEY);
  queryClient.clear();
  emitChange();
};

// 다른 탭에서 로그아웃해 저장된 토큰이 사라지면 이 탭의 메모리·캐시도 비운다.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.storageArea !== window.localStorage) return;
    if (
      (event.key === AUTHENTICATION_STORAGE_KEY || event.key === null) &&
      event.newValue === null &&
      state.session !== null
    ) {
      clearAuthentication('logout');
    }
  });
}
