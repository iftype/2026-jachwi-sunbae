import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';

import ConditionPanel from '@/pages/neighborhood-preview/ui/condition-panel/ConditionPanel';

type PanelPreview = Parameters<typeof ConditionPanel>[0]['preview'];

const preview = (overrides: Partial<PanelPreview> = {}): PanelPreview => ({
  hasChosenMapPoint: false,
  mapCandidate: {
    name: '서울시청',
    address: '서울 중구 세종대로 110',
    latitude: 37.5,
    longitude: 127,
  },
  isSearching: false,
  searchError: '',
  addressResults: [],
  selectAddress: vi.fn(),
  editLocation: vi.fn(),
  isMapSelectionEnabled: false,
  openMapSelection: vi.fn(),
  cancelMapSelection: vi.fn(),
  maxMinutes: 40,
  changeMaxMinutes: vi.fn(),
  maxTransfers: 1,
  changeMaxTransfers: vi.fn(),
  isValidCommuteTime: true,
  maxRent: 0,
  changeMaxRent: vi.fn(),
  ...overrides,
});

it('출퇴근 장소를 고르기 전에는 `지도에서 선택`으로 지도를 눌러 고르는 모드를 켠다', async () => {
  const value = preview();
  render(<ConditionPanel preview={value} disabled={false} onSubmit={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: '지도에서 선택' }));
  expect(value.openMapSelection).toHaveBeenCalledOnce();
});

it('모드를 켠 동안에는 `선택 취소`로 끈다', async () => {
  const value = preview({ isMapSelectionEnabled: true });
  render(<ConditionPanel preview={value} disabled={false} onSubmit={vi.fn()} />);
  expect(screen.getByText('지도에서 출퇴근할 위치를 눌러 주세요.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '선택 취소' }));
  expect(value.cancelMapSelection).toHaveBeenCalledOnce();
});

it('장소를 고른 뒤에는 이름과 `변경`을 보이고, 변경은 다시 고르는 모드를 연다', async () => {
  const value = preview({ hasChosenMapPoint: true });
  render(<ConditionPanel preview={value} disabled={false} onSubmit={vi.fn()} />);
  expect(screen.getByText('서울시청')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: '변경' }));
  expect(value.editLocation).toHaveBeenCalledOnce();
  expect(value.openMapSelection).toHaveBeenCalledOnce();
});

it('장소를 고르지 않았으면 찾기 버튼을 막고, `showActions`가 꺼지면 버튼 줄을 그리지 않는다', () => {
  const { rerender } = render(<ConditionPanel preview={preview()} disabled={false} onSubmit={vi.fn()} />);
  expect(screen.getByRole('button', { name: '이 조건으로 동네 찾기' })).toBeDisabled();
  rerender(<ConditionPanel preview={preview({ hasChosenMapPoint: true })} disabled={false} onSubmit={vi.fn()} />);
  expect(screen.getByRole('button', { name: '이 조건으로 동네 찾기' })).toBeEnabled();
  rerender(
    <ConditionPanel
      preview={preview({ hasChosenMapPoint: true })}
      disabled={false}
      onSubmit={vi.fn()}
      showActions={false}
    />,
  );
  expect(screen.queryByRole('button', { name: '이 조건으로 동네 찾기' })).not.toBeInTheDocument();
});
