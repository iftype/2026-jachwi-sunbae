import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import BottomSheet from './BottomSheet';
import { hideWhenSheetExpanded } from './hideWhenSheetExpanded';

const renderSheet = () =>
  render(
    <BottomSheet
      title="동네 정보"
      fullPage={false}
      onClose={() => undefined}
      floating={
        <button type="button" className={hideWhenSheetExpanded} aria-label="내 현재 위치로 이동">
          위치
        </button>
      }
    >
      내용
    </BottomSheet>,
  );

describe('BottomSheet floating 현재 위치 버튼', () => {
  it('시트 안 floating 칸에 들어 있어 시트와 함께 움직이고, 처음에는 보인다', () => {
    renderSheet();
    const button = screen.getByRole('button', { name: '내 현재 위치로 이동' });
    expect(screen.getByRole('region', { name: '동네 정보' }).contains(button)).toBe(true);
    expect(getComputedStyle(button).visibility).not.toBe('hidden');
  });

  it('시트를 크게 열면 숨기고, 다시 낮추면 보인다', () => {
    renderSheet();
    const sheet = screen.getByRole('region', { name: '동네 정보' });
    const handle = screen.getByRole('button', { name: '상세 패널 높이 조절' });
    const locate = () => screen.getByText('위치');
    fireEvent.keyDown(handle, { key: 'ArrowUp' });
    expect(sheet.dataset.mode).toBe('expanded');
    expect(getComputedStyle(locate()).visibility).toBe('hidden');
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(sheet.dataset.mode).toBe('default');
    expect(getComputedStyle(locate()).visibility).not.toBe('hidden');
  });
});
