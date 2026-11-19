import { useEffect } from 'react';

import { useAdminDongBookmarks } from '@/features/map/api/useAdminDongBookmarks';
import { useMapModeSwitch } from '@/shared/ui/map-mode-tile/MapModeContext';

import { hasUsedFinder, HIDE_FINDER_BANNER_AFTER_USE, markFinderUsed } from '../model/finderUsed';

/**
 * 내 기록 지도의 동네 찾기 안내(데스크탑 배너, 휴대폰 머리 칩)를 보일지 정하고, 누르면 동네 찾기로 넘어가는 함수를 준다.
 * 통합 지도 안이고, 동네 찾기를 써 본 적이 없고, 찜한 동네가 없을 때만 `open`을 돌려준다. 아니면 null.
 * 찜한 동네가 있다는 건 동네 찾기를 써 본 것이라 사용 기록도 남겨, 나중에 찜을 모두 풀어도 안내가 돌아오지 않는다.
 * 찜 목록을 불러오는 중에는 안내가 떴다 사라지지 않게 숨긴다.
 * (`HIDE_FINDER_BANNER_AFTER_USE`가 false면 항상 보인다.)
 */
export const useFinderPrompt = (): (() => void) | null => {
  const mode = useMapModeSwitch();
  const bookmarks = useAdminDongBookmarks();
  const hasBookmarks = bookmarks.codes.length > 0;
  useEffect(() => {
    if (hasBookmarks) markFinderUsed();
  }, [hasBookmarks]);
  if (mode === null) return null;
  if (HIDE_FINDER_BANNER_AFTER_USE && (bookmarks.isLoading || hasUsedFinder() || hasBookmarks)) return null;
  return () => {
    markFinderUsed();
    mode.onSwitch();
  };
};
