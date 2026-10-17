import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import useHorizontalDrag from '@/shared/lib/hooks/useHorizontalDrag';

const show = () => {
  const select = vi.fn();
  const Example = () => (
    <div aria-label="카드 목록" {...useHorizontalDrag()}>
      <button onClick={select}>동네</button>
    </div>
  );
  render(<Example />);
  const list = screen.getByLabelText('카드 목록');
  Object.assign(list, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn(), hasPointerCapture: () => true });
  const pointer = (type: string, clientX: number, pointerType = 'mouse') => {
    const event = new MouseEvent(type, { bubbles: true, clientX, button: 0 });
    Object.assign(event, { pointerId: 1, pointerType });
    fireEvent(list, event);
  };
  return { list, select, pointer, button: screen.getByRole('button', { name: '동네' }) };
};

it('마우스 드래그로 스크롤하고 드래그 직후의 카드 클릭은 취소한다', () => {
  const { list, select, pointer, button } = show();
  pointer('pointerdown', 150);
  pointer('pointermove', 60);
  expect(list.scrollLeft).toBe(90);
  pointer('pointerup', 60);
  fireEvent.click(button, { detail: 1 });
  expect(select).not.toHaveBeenCalled();
  pointer('pointerdown', 60);
  pointer('pointerup', 60);
  fireEvent.click(button, { detail: 1 });
  expect(select).toHaveBeenCalledOnce();
});

it('터치 스크롤과 키보드 카드 선택을 가로채지 않는다', () => {
  const { list, select, pointer, button } = show();
  pointer('pointerdown', 150, 'touch');
  pointer('pointermove', 60, 'touch');
  expect(list.scrollLeft).toBe(0);
  fireEvent.click(button, { detail: 0 });
  expect(select).toHaveBeenCalledOnce();
});
