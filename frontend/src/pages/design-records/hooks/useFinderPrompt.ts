import { useAdminDongBookmarks } from '@/features/map/api/useAdminDongBookmarks';
import { useMapModeSwitch } from '@/shared/ui/map-mode-tile/MapModeContext';

import { hasUsedFinder, HIDE_FINDER_BANNER_AFTER_USE, markFinderUsed } from '../model/finderUsed';

/**
 * 내 기록 지도의 동네 찾기 안내(데스크탑 배너, 휴대폰 머리 칩)를 보일지 정하고, 누르면 동네 찾기로 넘어가는 함수를 준다.
 * 통합 지도 안이고, 동네 찾기를 써 본 적이 없고, 찜한 동네가 없을 때만 `open`을 돌려준다. 아니면 null.
 * (`HIDE_FINDER_BANNER_AFTER_USE`가 false면 항상 보인다.)
 */
export const useFinderPrompt = (): (() => void) | null => {
  const mode = useMapModeSwitch();
  const bookmarks = useAdminDongBookmarks();
  if (mode === null) return null;
  if (HIDE_FINDER_BANNER_AFTER_USE && (hasUsedFinder() || bookmarks.codes.length > 0)) return null;
  return () => {
    markFinderUsed();
    mode.onSwitch();
  };
};
