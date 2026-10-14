import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';

import WheelPicker from '@/shared/ui/wheel-picker/WheelPicker';

const options = [5, 10, 15].map((value) => ({ value, label: `${value}분` }));
it('선택 상태를 표시하고 키보드로 범위 안에서만 이동한다', async () => {
  const Example = () => {
    const [value, setValue] = useState(10);
    return <WheelPicker label="시간" options={options} value={value} onValueChange={setValue} />;
  };
  render(<Example />);
  screen.getByRole('listbox').focus();
  await userEvent.keyboard('{ArrowDown}{ArrowDown}');
  expect(screen.getByRole('option', { name: '15분' })).toHaveAttribute('aria-selected', 'true');
  await userEvent.keyboard('{Home}');
  expect(screen.getByRole('option', { name: '5분' })).toHaveAttribute('aria-selected', 'true');
});
it('스크롤이 멈춘 후 가장 가까운 항목을 선택한다', () => {
  vi.useFakeTimers();
  try {
    const change = vi.fn();
    render(<WheelPicker label="시간" options={options} value={5} onValueChange={change} />);
    fireEvent.scroll(screen.getByRole('option', { name: '5분' }).parentElement!, { target: { scrollTop: 88 } });
    expect(change).not.toHaveBeenCalled();
    vi.advanceTimersByTime(150);
    expect(change).toHaveBeenCalledWith(15);
  } finally {
    vi.useRealTimers();
  }
});
