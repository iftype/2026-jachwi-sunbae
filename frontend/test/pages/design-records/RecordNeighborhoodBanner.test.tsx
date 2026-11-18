import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  hasSeenRecordsMapIntro,
  hideRecordsMapIntroToday,
  markRecordsMapIntroSeen,
} from '@/pages/design-records/model/recordsMapIntro';
import RecordNeighborhoodBanner from '@/pages/design-records/ui/record-neighborhood-banner/RecordNeighborhoodBanner';
import { MapModeProvider } from '@/shared/ui/map-mode-tile/MapModeContext';

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
    await userEvent.click(screen.getByRole('button', { name: '10초만에 동네 찾기' }));
    expect(onSwitch).toHaveBeenCalledOnce();
    expect(screen.queryByRole('complementary', { name: '동네 찾기 안내' })).not.toBeInTheDocument();
    expect(hasSeenRecordsMapIntro()).toBe(true);
  });

  it('닫기는 영영 숨기고, 오늘 하루 보지 않기는 오늘만 숨긴다', async () => {
    renderBanner();
    await userEvent.click(screen.getByRole('button', { name: '오늘 하루 보지 않기' }));
    expect(screen.queryByRole('complementary', { name: '동네 찾기 안내' })).not.toBeInTheDocument();
    expect(localStorage.getItem('jachwi:records-map-intro-seen')).toBeNull();
    expect(localStorage.getItem('jachwi:records-map-intro-hidden-day')).not.toBeNull();
  });

  it('이미 본 사람에게는 보이지 않고, 통합 지도 밖에서도 보이지 않는다', () => {
    markRecordsMapIntroSeen();
    renderBanner();
    expect(screen.queryByRole('complementary', { name: '동네 찾기 안내' })).not.toBeInTheDocument();
  });

  it('동네 찾기로 넘어갈 방법이 없으면 그리지 않는다', () => {
    render(<RecordNeighborhoodBanner />);
    expect(screen.queryByRole('complementary', { name: '동네 찾기 안내' })).not.toBeInTheDocument();
  });
});
