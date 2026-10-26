import { describe, expect, it } from 'vitest';

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
  it('토큰은 메모리에만 두고 브라우저 저장소에 남기지 않는다', () => {
    setAuthentication({ accessToken: 'memory-token', tokenType: 'Bearer', expiresIn: 60, memberId: 1 });

    expect(getAccessToken()).toBe('memory-token');
    expect(window.localStorage).toHaveLength(0);
    expect(window.sessionStorage).toHaveLength(0);
  });

  it('expiresIn을 기준으로 만료 시각을 계산한다', () => {
    expect(calculateExpiresAt(900, 1_000)).toBe(901_000);
  });

  it('만료된 토큰은 돌려주지 않지만 세션과 화면 캐시는 지우지 않는다', () => {
    queryClient.setQueryData(propertyQueryKeys.detail(10), { name: '보던 매물' });
    setAuthentication({ accessToken: 'expired-token', tokenType: 'Bearer', expiresIn: 0, memberId: 1 });

    expect(getAccessToken()).toBeNull();
    expect(getAuthenticationSnapshot().session).not.toBeNull();
    expect(queryClient.getQueryData(propertyQueryKeys.detail(10))).toEqual({ name: '보던 매물' });
  });

  it('같은 회원의 토큰 갱신은 화면 캐시를 그대로 둔다', () => {
    setAuthentication({ accessToken: 'first-token', tokenType: 'Bearer', expiresIn: 60, memberId: 1 });
    queryClient.setQueryData(propertyQueryKeys.detail(10), { name: '보던 매물' });

    setAuthentication({ accessToken: 'refreshed-token', tokenType: 'Bearer', expiresIn: 60, memberId: 1 });

    expect(getAccessToken()).toBe('refreshed-token');
    expect(queryClient.getQueryData(propertyQueryKeys.detail(10))).toEqual({ name: '보던 매물' });
  });

  it('다른 회원으로 바뀌면 이전 회원의 Query Cache를 재사용하지 않는다', () => {
    setAuthentication({ accessToken: 'member-a-token', tokenType: 'Bearer', expiresIn: 60, memberId: 1 });
    queryClient.setQueryData(currentMemberQueryKey, { memberId: 1 });
    queryClient.setQueryData(propertyQueryKeys.detail(10), { name: '첫 회원 매물' });

    setAuthentication({ accessToken: 'member-b-token', tokenType: 'Bearer', expiresIn: 60, memberId: 2 });

    expect(getAccessToken()).toBe('member-b-token');
    expect(queryClient.getQueryData(currentMemberQueryKey)).toBeUndefined();
    expect(queryClient.getQueryData(propertyQueryKeys.detail(10))).toBeUndefined();
  });

  it('복원이 거절되면 세션과 회원 캐시를 지우고 까닭을 남긴다', () => {
    setAuthentication({ accessToken: 'member-token', tokenType: 'Bearer', expiresIn: 60, memberId: 1 });
    queryClient.setQueryData(currentMemberQueryKey, { memberId: 1 });

    clearAuthentication('unauthorized');

    expect(getAuthenticationSnapshot()).toEqual({ session: null, terminationReason: 'unauthorized' });
    expect(queryClient.getQueryData(currentMemberQueryKey)).toBeUndefined();
  });
});
