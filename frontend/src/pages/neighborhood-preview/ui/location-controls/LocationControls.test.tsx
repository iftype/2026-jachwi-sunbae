import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import BottomSheet from '@/shared/ui/bottom-sheet/BottomSheet';
import { hideWhenSheetExpanded } from '@/shared/ui/bottom-sheet/hideWhenSheetExpanded';

import LocationControls from './LocationControls';

const preview = { isLocating: false, locationError: null, moveToCurrentLocation: vi.fn() };

const renderDocked = () =>
  render(
    <div className="NeighborhoodPreviewPage-page">
      <BottomSheet
        title="동네 정보"
        fullPage={false}
        onClose={() => undefined}
        floating={<LocationControls preview={preview} isResult docked className={hideWhenSheetExpanded} />}
      >
        <p>내용</p>
      </BottomSheet>
    </div>,
  );

describe('LocationControls 시트 위 배치', () => {
  it('시트 내용(content) 안이 아니라 시트 위 floating 칸에 들어가고, 지도 위 고정 위치를 풀어 둔다', () => {
    renderDocked();
    const button = screen.getByRole('button', { name: '내 현재 위치로 이동' });
    const controls = button.parentElement;
    expect(controls?.dataset.docked).toBe('true');
    expect(controls?.dataset.result).toBeUndefined();
    expect(getComputedStyle(controls as Element).position).toBe('relative');
    const content = screen.getByText('내용').parentElement;
    expect(content?.contains(button)).toBe(false);
    expect(screen.getByRole('region', { name: '동네 정보' }).contains(button)).toBe(true);
  });

  it('시트를 크게 열면 숨기고 낮추면 다시 보인다', () => {
    renderDocked();
    const handle = screen.getByRole('button', { name: '상세 패널 높이 조절' });
    const controls = () => screen.getByLabelText('내 현재 위치로 이동').parentElement as Element;
    fireEvent.keyDown(handle, { key: 'ArrowUp' });
    expect(getComputedStyle(controls()).visibility).toBe('hidden');
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(getComputedStyle(controls()).visibility).not.toBe('hidden');
  });
});
