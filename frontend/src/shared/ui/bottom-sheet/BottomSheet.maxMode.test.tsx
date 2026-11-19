import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import BottomSheet from './BottomSheet';

const renderSheet = (onClose = vi.fn()) => {
  render(
    <div>
      <BottomSheet title="장충동" fullPage={false} maxMode="default" onClose={onClose}>
        내용
      </BottomSheet>
    </div>,
  );
  const sheet = screen.getByRole('region', { name: '장충동' });
  const handle = screen.getByRole('button', { name: '상세 패널 높이 조절' });
  // 시트는 300px, 지도 칸은 800px이라 놓는 높이로 단계를 정한다.
  vi.spyOn(sheet, 'getBoundingClientRect').mockReturnValue({ height: 300 } as DOMRect);
  const parent = sheet.parentElement;
  if (parent !== null) vi.spyOn(parent, 'getBoundingClientRect').mockReturnValue({ height: 800 } as DOMRect);
  const drag = (from: number, to: number) => {
    fireEvent.pointerDown(handle, { button: 0, clientY: from, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: to, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientY: to, pointerId: 1 });
  };
  return { sheet, handle, drag, onClose };
};

describe('BottomSheet 가장 높은 단계(maxMode)', () => {
  it('maxMode가 default면 끝까지 끌어 올려도 처음 높이에 머문다', () => {
    const { sheet, drag } = renderSheet();
    drag(600, 50);
    expect(sheet.dataset.mode).toBe('default');
  });

  it('끄는 동안에도 처음 높이 위로는 밀어 올리지 않는다', () => {
    const { sheet, handle } = renderSheet();
    fireEvent.pointerDown(handle, { button: 0, clientY: 600, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 100, pointerId: 1 });
    expect(sheet.style.getPropertyValue('--sheet-height')).toBe('300px');
    expect(sheet.style.transform).toBe('translateY(0px)');
  });

  it('키보드 위 화살표로도 펼치지 않고, 아래로 내리기와 닫기는 그대로다', () => {
    const { sheet, handle, drag, onClose } = renderSheet();
    fireEvent.keyDown(handle, { key: 'ArrowUp' });
    expect(sheet.dataset.mode).toBe('default');
    expect(handle).toHaveAttribute('aria-expanded', 'false');
    drag(600, 590);
    expect(onClose).not.toHaveBeenCalled();
    drag(500, 750);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(sheet.dataset.mode).toBe('peek');
  });

  it('maxMode가 없으면 끌어 올려 크게 연다', () => {
    render(
      <div>
        <BottomSheet title="매물" fullPage={false} onClose={() => undefined}>
          내용
        </BottomSheet>
      </div>,
    );
    const sheet = screen.getByRole('region', { name: '매물' });
    const handle = screen.getByRole('button', { name: '상세 패널 높이 조절' });
    vi.spyOn(sheet, 'getBoundingClientRect').mockReturnValue({ height: 300 } as DOMRect);
    const parent = sheet.parentElement;
    if (parent !== null) vi.spyOn(parent, 'getBoundingClientRect').mockReturnValue({ height: 800 } as DOMRect);
    fireEvent.pointerDown(handle, { button: 0, clientY: 600, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientY: 50, pointerId: 1 });
    expect(sheet.dataset.mode).toBe('expanded');
  });
});
