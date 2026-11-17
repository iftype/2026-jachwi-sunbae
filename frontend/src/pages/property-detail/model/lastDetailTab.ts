import { getAuthenticationSnapshot } from '@/features/auth/model/authStore';

import { type DetailTab, parseDetailTab } from './detailTab';

/**
 * 매물마다 마지막으로 본 상세 탭. 홈, 목록, 지도처럼 탭 없이 같은 매물에 다시 들어와도 그 탭을 연다.
 * 브라우저 탭(세션)에만 두고, 적은 회원 번호가 지금 회원과 다르면(초기화, 탈퇴, 다른 계정) 쓰지 않는다.
 */
const LAST_DETAIL_TAB_KEY = 'jachwi-sunbae.propertyDetail.lastTabs';

type StoredTabs = { memberId: number; tabs: Record<string, DetailTab> };

const currentMemberId = (): number | null => getAuthenticationSnapshot().session?.memberId ?? null;

const readStored = (storage: Storage, memberId: number): StoredTabs => {
  try {
    const value: unknown = JSON.parse(storage.getItem(LAST_DETAIL_TAB_KEY) ?? 'null');
    if (typeof value !== 'object' || value === null) return { memberId, tabs: {} };
    const { memberId: storedMemberId, tabs } = value as Record<string, unknown>;
    if (storedMemberId !== memberId || typeof tabs !== 'object' || tabs === null) return { memberId, tabs: {} };
    const parsed: Record<string, DetailTab> = {};
    for (const [propertyId, tab] of Object.entries(tabs)) {
      const detailTab = typeof tab === 'string' ? parseDetailTab(tab) : null;
      if (detailTab !== null) parsed[propertyId] = detailTab;
    }
    return { memberId, tabs: parsed };
  } catch {
    return { memberId, tabs: {} };
  }
};

export const readLastDetailTab = (propertyId: number, storage: Storage = window.sessionStorage): DetailTab | null => {
  const memberId = currentMemberId();
  if (memberId === null) return null;
  try {
    return readStored(storage, memberId).tabs[String(propertyId)] ?? null;
  } catch {
    return null;
  }
};

export const writeLastDetailTab = (
  propertyId: number,
  tab: DetailTab,
  storage: Storage = window.sessionStorage,
): void => {
  const memberId = currentMemberId();
  if (memberId === null) return;
  try {
    const stored = readStored(storage, memberId);
    stored.tabs[String(propertyId)] = tab;
    storage.setItem(LAST_DETAIL_TAB_KEY, JSON.stringify(stored));
  } catch {
    // 브라우저 저장소를 쓸 수 없으면 탭 없이 들어올 때 정보 탭을 열 뿐이다.
  }
};
