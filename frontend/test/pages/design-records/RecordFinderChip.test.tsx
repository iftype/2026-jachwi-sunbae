import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import RecordsMobileHeader from '@/pages/design-records/mobile/RecordsMobileHeader';
import { hasUsedFinder, markFinderUsed } from '@/pages/design-records/model/finderUsed';
import { MapModeProvider } from '@/shared/ui/map-mode-tile/MapModeContext';

vi.mock('@/features/map/api/useAdminDongBookmarks', () => ({
  useAdminDongBookmarks: () => ({ codes: [] }),
}));
vi.mock('@/features/weather/ui/map-header-weather/MapHeaderWeather', () => ({ default: () => null }));

const CHIP = { name: '출퇴근 시간으로 동네 찾기' };

const renderHeader = (view: 'map' | 'list' = 'map', onSwitch = vi.fn()) => {
  render(
    <MemoryRouter>
      <MapModeProvider value={{ target: 'neighborhoods', onSwitch }}>
        <RecordsMobileHeader view={view} onRecord={vi.fn()} />
      </MapModeProvider>
    </MemoryRouter>,
  );
  return onSwitch;
};

beforeEach(() => {
  localStorage.clear();
});

describe('RecordFinderChip (휴대폰 머리 줄)', () => {
  it('동네 찾기를 써 본 적이 없으면 머리 줄에 칩이 보이고, 큰 카드 배너는 없다', () => {
    renderHeader();
    expect(screen.getByRole('banner', { name: '지도 목록 헤더' })).toContainElement(screen.getByRole('button', CHIP));
    expect(screen.queryByText('어디 살지 고민이라면?')).not.toBeInTheDocument();
  });

  it('누르면 동네 찾기로 넘어가고 다시 띄우지 않는다', async () => {
    const onSwitch = renderHeader();
    await userEvent.click(screen.getByRole('button', CHIP));
    // 첫 안내로 넘어간다고 알려, 동네 찾기가 첫 안내 말풍선 자리로 지도를 옮기고 확대하게 한다.
    expect(onSwitch).toHaveBeenCalledExactlyOnceWith('first-prompt');
    expect(hasUsedFinder()).toBe(true);
  });

  it('한 번 쓴 뒤에는 보이지 않는다', () => {
    markFinderUsed();
    renderHeader();
    expect(screen.queryByRole('button', CHIP)).not.toBeInTheDocument();
  });

  it('리스트 보기에서는 칩을 두지 않는다', () => {
    renderHeader('list');
    expect(screen.queryByRole('button', CHIP)).not.toBeInTheDocument();
  });
});
