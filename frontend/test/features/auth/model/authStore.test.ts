import { describe, expect, it, vi } from 'vitest';

import {
  calculateExpiresAt,
  clearAuthentication,
  getAccessToken,
  getAuthenticationSnapshot,
  setAuthentication,
} from '@/features/auth/model/authStore';
import { propertyQueryKeys } from '@/features/property/api/propertyQueryKeys';
import { currentMemberQueryKey, queryClient } from '@/shared/api/queryClient';

describe('인증 저장소', () => {
  it('로그아웃은 메모리와 저장된 토큰을 모두 지운다', () => {
    setAuthentication({ accessToken: 'test-login', tokenType: 'Bearer', expiresIn: 60 });
    clearAuthentication('logout');
    expect(getAccessToken()).toBeNull();
    expect(localStorage.getItem('jachwi-sunbae.authentication.session')).toBeNull();
  });
  it('다른 탭에서 로그아웃해도 이 탭의 세션과 회원 캐시를 지운다', () => {
    setAuthentication({ accessToken: 'test-login', tokenType: 'Bearer', expiresIn: 60 });
    queryClient.setQueryData(currentMemberQueryKey, { memberId: 1 });
    localStorage.removeItem('jachwi-sunbae.authentication.session');
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'jachwi-sunbae.authentication.session',
        newValue: null,
        storageArea: localStorage,
      }),
    );
    expect(getAccessToken()).toBeNull();
    expect(queryClient.getQueryData(currentMemberQueryKey)).toBeUndefined();
  });
  it('expiresIn을 기준으로 만료 시각을 계산한다', () => {
    expect(calculateExpiresAt(43_200, 1_000)).toBe(43_201_000);
  });

  it('앱을 다시 열어도 로그인 상태를 복원할 수 있도록 localStorage에 저장한다', () => {
    setAuthentication({ accessToken: 'memory-token', tokenType: 'Bearer', expiresIn: 60 });

    expect(getAccessToken()).toBe('memory-token');
    expect(window.localStorage).toHaveLength(1);
    expect(window.sessionStorage).toHaveLength(0);
  });

  it('만료되면 인증과 인증 Query Cache를 정리한다', () => {
    vi.useFakeTimers();
    queryClient.setQueryData(currentMemberQueryKey, { memberId: 1 });
    queryClient.setQueryData(propertyQueryKeys.detail(10), { name: '다른 회원에게 남기면 안 되는 매물' });
    setAuthentication({ accessToken: 'short-token', tokenType: 'Bearer', expiresIn: 1 });

    vi.advanceTimersByTime(1_001);

    expect(getAuthenticationSnapshot()).toEqual({
      session: null,
      terminationReason: 'expired',
    });
    expect(queryClient.getQueryData(currentMemberQueryKey)).toBeUndefined();
    expect(queryClient.getQueryData(propertyQueryKeys.detail(10))).toBeUndefined();
    vi.useRealTimers();
  });

  it('다른 인증으로 교체할 때 이전 회원의 Query Cache를 재사용하지 않는다', () => {
    setAuthentication({ accessToken: 'member-a-token', tokenType: 'Bearer', expiresIn: 60 });
    queryClient.setQueryData(currentMemberQueryKey, { memberId: 1 });
    queryClient.setQueryData(propertyQueryKeys.detail(10), { name: '첫 회원 매물' });

    setAuthentication({ accessToken: 'member-b-token', tokenType: 'Bearer', expiresIn: 60 });

    expect(getAccessToken()).toBe('member-b-token');
    expect(queryClient.getQueryData(currentMemberQueryKey)).toBeUndefined();
    expect(queryClient.getQueryData(propertyQueryKeys.detail(10))).toBeUndefined();
  });
});
