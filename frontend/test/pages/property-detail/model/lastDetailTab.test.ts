import { afterEach, describe, expect, it } from 'vitest';

import { readLastDetailTab, writeLastDetailTab } from '@/pages/property-detail/model/lastDetailTab';
import { resetAuthenticationForTests, setAuthentication } from '@/features/auth/model/authStore';

const KEY = 'jachwi-sunbae.propertyDetail.lastTabs';

const signIn = (memberId: number) =>
  setAuthentication({ accessToken: 'valid-token', tokenType: 'Bearer', expiresIn: 60, memberId });

afterEach(() => {
  resetAuthenticationForTests();
  sessionStorage.clear();
});

describe('매물마다 마지막으로 본 상세 탭', () => {
  it('매물마다 따로 기억하고, 처음 보는 매물은 비워 둔다', () => {
    signIn(1);
    writeLastDetailTab(10, 'checklist');
    writeLastDetailTab(11, 'details');

    expect(readLastDetailTab(10)).toBe('checklist');
    expect(readLastDetailTab(11)).toBe('details');
    expect(readLastDetailTab(12)).toBeNull();
    expect(JSON.parse(sessionStorage.getItem(KEY) ?? 'null')).toEqual({
      memberId: 1,
      tabs: { 10: 'checklist', 11: 'details' },
    });
  });

  it('로그인 전이면 읽지도 쓰지도 않는다', () => {
    writeLastDetailTab(10, 'checklist');

    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect(readLastDetailTab(10)).toBeNull();
  });

  it('다른 회원이 적어 둔 탭은 쓰지 않고, 새로 적으면 지금 회원 것으로 바꾼다', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ memberId: 1, tabs: { 10: 'checklist', 11: 'checklist' } }));
    signIn(2);

    expect(readLastDetailTab(10)).toBeNull();
    writeLastDetailTab(11, 'details');
    expect(JSON.parse(sessionStorage.getItem(KEY) ?? 'null')).toEqual({ memberId: 2, tabs: { 11: 'details' } });
  });

  it('깨진 값이나 모르는 탭 이름은 무시한다', () => {
    signIn(1);
    sessionStorage.setItem(KEY, JSON.stringify({ memberId: 1, tabs: { 10: 'photos', 11: 3, 12: 'checklist' } }));
    expect(readLastDetailTab(10)).toBeNull();
    expect(readLastDetailTab(11)).toBeNull();
    expect(readLastDetailTab(12)).toBe('checklist');

    sessionStorage.setItem(KEY, '{깨진 값');
    expect(readLastDetailTab(12)).toBeNull();
    writeLastDetailTab(10, 'details');
    expect(readLastDetailTab(10)).toBe('details');
  });
});
