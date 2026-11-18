import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hasUsedFinder, markFinderUsed } from '@/pages/design-records/model/finderUsed';
import {
  hasSeenRecordsMapIntro,
  hideRecordsMapIntroToday,
  markRecordsMapIntroSeen,
} from '@/pages/design-records/model/recordsMapIntro';
import RecordNeighborhoodBanner from '@/pages/design-records/ui/record-neighborhood-banner/RecordNeighborhoodBanner';
import { MapModeProvider } from '@/shared/ui/map-mode-tile/MapModeContext';

vi.mock('@/features/map/api/useAdminDongBookmarks', () => ({
  useAdminDongBookmarks: () => ({ codes: [] }),
}));

beforeEach(() => {
  localStorage.clear();
});

describe('recordsMapIntro', () => {
  it('처음에는 보지 않은 것으로 보고, 닫기를 누르면 계속 본 것으로 친다', () => {
    expect(hasSeenRecordsMapIntro()).toBe(false);
    markRecordsMapIntroSeen();
    expect(hasSeenRecordsMapIntro()).toBe(true);
  });

  it('오늘 하루 보지 않기는 오늘만 숨기고 날짜가 바뀌면 다시 보인다', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 10, 18, 9));
      hideRecordsMapIntroToday();
      expect(hasSeenRecordsMapIntro()).toBe(true);
      vi.setSystemTime(new Date(2026, 10, 19, 9));
      expect(hasSeenRecordsMapIntro()).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('RecordNeighborhoodBanner', () => {
  const renderBanner = (onSwitch = vi.fn()) => {
    render(
      <MapModeProvider value={{ target: 'neighborhoods', onSwitch }}>
        <RecordNeighborhoodBanner />
      </MapModeProvider>,
    );
    return onSwitch;
  };

  it('동네 찾기 버튼을 누르면 동네 찾기로 넘어가고 다시 띄우지 않는다', async () => {
    const onSwitch = renderBanner();
    await userEvent.click(screen.getByRole('button', { name: /출퇴근 시간으로 동네 찾아보기/ }));
    expect(onSwitch).toHaveBeenCalledOnce();
    expect(hasUsedFinder()).toBe(true);
  });

  it('이미 사용하면 지도에 돌아와도 다시 보이지 않는다', () => {
    markFinderUsed();
    renderBanner();
    expect(screen.queryByRole('button', { name: /출퇴근 시간으로 동네 찾아보기/ })).not.toBeInTheDocument();
  });

  it('동네 찾기로 넘어갈 방법이 없으면 그리지 않는다', () => {
    render(<RecordNeighborhoodBanner />);
    expect(screen.queryByRole('button', { name: /출퇴근 시간으로 동네 찾아보기/ })).not.toBeInTheDocument();
  });
});
